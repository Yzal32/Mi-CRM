import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { createUser, deactivateEmployee } from "./model/users";
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

describe("deactivateEmployee", () => {
  test("pasa status a 'inactive'", async () => {
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

    await t.run((ctx) => deactivateEmployee(ctx, { userId }));

    const doc = await t.run((ctx) => ctx.db.get(userId));
    expect(doc?.status).toBe("inactive");
  });

  test("destruye las sesiones previas del empleado", async () => {
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

    await t.run((ctx) => deactivateEmployee(ctx, { userId }));

    expect(await t.run((ctx) => verifySession(ctx, oldToken))).toBeNull();
  });

  test("es idempotente: desactivar una cuenta ya inactiva no lanza", async () => {
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

    await t.run((ctx) => deactivateEmployee(ctx, { userId }));
    await t.run((ctx) => deactivateEmployee(ctx, { userId }));

    const doc = await t.run((ctx) => ctx.db.get(userId));
    expect(doc?.status).toBe("inactive");
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

    const error = await captureError(t.run((ctx) => deactivateEmployee(ctx, { userId })));
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

    const error = await captureError(t.run((ctx) => deactivateEmployee(ctx, { userId: ownerId })));
    expect(error.data.code).toBe("NOT_AN_EMPLOYEE");

    const doc = await t.run((ctx) => ctx.db.get(ownerId));
    expect(doc?.status).toBe("active");
  });
});
