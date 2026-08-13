import { compareSync } from "bcryptjs";
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { createUser, resetEmployeePassword, TEMP_PASSWORD_ALPHABET } from "./model/users";
import { createSessionForUser, verifySession } from "./model/sessions";

const modules = import.meta.glob("./**/*.ts");

type CodeErrorData = { code: string; message: string };

async function captureError(promise: Promise<unknown>): Promise<ConvexError<CodeErrorData>> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ConvexError) return error as ConvexError<CodeErrorData>;
    throw error;
  }
  throw new Error("se esperaba que la promesa fallara");
}

// Construido desde la constante real del generador, no tecleado a mano:
// evita que el test diverja del alfabeto y falle solo de forma no
// determinista según qué carácter tocara el sorteo aleatorio.
const TEMP_PASSWORD_PATTERN = new RegExp(`^[${TEMP_PASSWORD_ALPHABET}]{8}$`);

describe("resetEmployeePassword", () => {
  test("genera una contraseña de 8 caracteres, todos del alfabeto sin ambiguos", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-segura",
        role: "employee",
        mustChangePassword: false,
      }),
    );

    const { temporaryPassword } = await t.run((ctx) => resetEmployeePassword(ctx, { userId }));
    expect(temporaryPassword).toMatch(TEMP_PASSWORD_PATTERN);
  });

  test("la contraseña temporal funciona para autenticar y marca mustChangePassword", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-segura",
        role: "employee",
        mustChangePassword: false,
      }),
    );

    const { temporaryPassword } = await t.run((ctx) => resetEmployeePassword(ctx, { userId }));

    const doc = await t.run((ctx) => ctx.db.get(userId));
    expect(compareSync(temporaryPassword, doc!.passwordHash)).toBe(true);
    expect(doc?.mustChangePassword).toBe(true);
  });

  test("invalida las sesiones previas del empleado", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-segura",
        role: "employee",
        mustChangePassword: false,
      }),
    );
    const oldToken = await t.run((ctx) => createSessionForUser(ctx, userId));
    expect(await t.run((ctx) => verifySession(ctx, oldToken))).not.toBeNull();

    await t.run((ctx) => resetEmployeePassword(ctx, { userId }));

    expect(await t.run((ctx) => verifySession(ctx, oldToken))).toBeNull();
  });

  test("USER_NOT_FOUND si el usuario ya no existe", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-segura",
        role: "employee",
        mustChangePassword: false,
      }),
    );
    await t.run((ctx) => ctx.db.delete(userId));

    const error = await captureError(t.run((ctx) => resetEmployeePassword(ctx, { userId })));
    expect(error.data.code).toBe("USER_NOT_FOUND");
  });

  test("NOT_AN_EMPLOYEE si el objetivo es la Dueña", async () => {
    const t = convexTest(schema, modules);
    const ownerId = await t.run((ctx) =>
      createUser(ctx, {
        name: "Marta Gómez",
        email: "marta@ejemplo.com",
        password: "contraseña-segura",
        role: "owner",
        mustChangePassword: false,
      }),
    );

    const error = await captureError(t.run((ctx) => resetEmployeePassword(ctx, { userId: ownerId })));
    expect(error.data.code).toBe("NOT_AN_EMPLOYEE");
  });
});
