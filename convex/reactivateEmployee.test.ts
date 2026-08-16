import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { createUser, reactivateEmployee } from "./model/users";
import { login } from "./model/sessions";

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

describe("reactivateEmployee", () => {
  test("pasa status a 'active'", async () => {
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
    await t.run((ctx) => ctx.db.patch(userId, { status: "inactive" }));

    await t.run((ctx) => reactivateEmployee(ctx, { userId }));

    const doc = await t.run((ctx) => ctx.db.get(userId));
    expect(doc?.status).toBe("active");
  });

  test("el empleado reactivado puede volver a iniciar sesión", async () => {
    const t = convexTest(schema, modules);
    const email = "carlos@ejemplo.com";
    const password = "contraseña-segura";
    const userId = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email,
        password,
        role: "employee",
        mustChangePassword: false,
      }),
    );
    await t.run((ctx) => ctx.db.patch(userId, { status: "inactive" }));
    const blocked = await captureError(t.run((ctx) => login(ctx, { email, password })));
    expect(blocked.data.code).toBe("ACCOUNT_INACTIVE");

    await t.run((ctx) => reactivateEmployee(ctx, { userId }));

    const result = await t.run((ctx) => login(ctx, { email, password }));
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
  });

  test("es idempotente: reactivar una cuenta ya activa no lanza", async () => {
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

    await t.run((ctx) => reactivateEmployee(ctx, { userId }));

    const doc = await t.run((ctx) => ctx.db.get(userId));
    expect(doc?.status).toBe("active");
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

    const error = await captureError(t.run((ctx) => reactivateEmployee(ctx, { userId })));
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

    const error = await captureError(t.run((ctx) => reactivateEmployee(ctx, { userId: ownerId })));
    expect(error.data.code).toBe("NOT_AN_EMPLOYEE");
  });
});
