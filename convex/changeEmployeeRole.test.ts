import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { changeEmployeeRole, createUser } from "./model/users";
import { issueTestActor } from "./testHelpers";

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

describe("changeEmployeeRole", () => {
  test("asciende employee -> owner", async () => {
    const t = convexTest(schema, modules);
    const { userId: callerId } = await issueTestActor(t, "owner");
    const userId = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-segura",
        role: "employee",
        mustChangePassword: false,
      }),
    );

    await t.run((ctx) => changeEmployeeRole(ctx, { userId, role: "owner", callerId }));

    const doc = await t.run((ctx) => ctx.db.get(userId));
    expect(doc?.role).toBe("owner");
  });

  test("degrada owner -> employee cuando hay otra cuenta Dueña", async () => {
    const t = convexTest(schema, modules);
    const martaId = await t.run((ctx) =>
      createUser(ctx, {
        name: "Marta Gómez",
        email: "marta@ejemplo.com",
        password: "contraseña-segura",
        role: "owner",
        mustChangePassword: false,
      }),
    );
    const carlosId = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-segura",
        role: "owner",
        mustChangePassword: false,
      }),
    );

    await t.run((ctx) => changeEmployeeRole(ctx, { userId: carlosId, role: "employee", callerId: martaId }));

    const doc = await t.run((ctx) => ctx.db.get(carlosId));
    expect(doc?.role).toBe("employee");
  });

  test("CANNOT_REMOVE_LAST_OWNER al degradar la única cuenta Dueña, aunque no sea un auto-cambio", async () => {
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
    // Caller distinto del objetivo a propósito: aísla CANNOT_REMOVE_LAST_OWNER
    // de CANNOT_CHANGE_OWN_ROLE (ver test siguiente), que se comprueba antes
    // y taparía este caso si caller y objetivo coincidieran.
    const otherId = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-segura",
        role: "employee",
        mustChangePassword: false,
      }),
    );

    const error = await captureError(
      t.run((ctx) => changeEmployeeRole(ctx, { userId: ownerId, role: "employee", callerId: otherId })),
    );
    expect(error.data.code).toBe("CANNOT_REMOVE_LAST_OWNER");

    const doc = await t.run((ctx) => ctx.db.get(ownerId));
    expect(doc?.role).toBe("owner");
  });

  test("CANNOT_CHANGE_OWN_ROLE cuando la única Dueña intenta quitarse el rol a sí misma", async () => {
    const t = convexTest(schema, modules);
    const { userId: ownerId } = await issueTestActor(t, "owner");

    const error = await captureError(
      t.run((ctx) => changeEmployeeRole(ctx, { userId: ownerId, role: "employee", callerId: ownerId })),
    );
    expect(error.data.code).toBe("CANNOT_CHANGE_OWN_ROLE");

    const doc = await t.run((ctx) => ctx.db.get(ownerId));
    expect(doc?.role).toBe("owner");
  });

  test("CANNOT_CHANGE_OWN_ROLE incluso con otra cuenta Dueña disponible (no es solo un efecto de CANNOT_REMOVE_LAST_OWNER)", async () => {
    const t = convexTest(schema, modules);
    const martaId = await t.run((ctx) =>
      createUser(ctx, {
        name: "Marta Gómez",
        email: "marta@ejemplo.com",
        password: "contraseña-segura",
        role: "owner",
        mustChangePassword: false,
      }),
    );
    await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-segura",
        role: "owner",
        mustChangePassword: false,
      }),
    );

    const error = await captureError(
      t.run((ctx) => changeEmployeeRole(ctx, { userId: martaId, role: "employee", callerId: martaId })),
    );
    expect(error.data.code).toBe("CANNOT_CHANGE_OWN_ROLE");

    const doc = await t.run((ctx) => ctx.db.get(martaId));
    expect(doc?.role).toBe("owner");
  });

  test("USER_NOT_FOUND si el usuario ya no existe", async () => {
    const t = convexTest(schema, modules);
    const { userId: callerId } = await issueTestActor(t, "owner");
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

    const error = await captureError(t.run((ctx) => changeEmployeeRole(ctx, { userId, role: "owner", callerId })));
    expect(error.data.code).toBe("USER_NOT_FOUND");
  });

  test("es idempotente: fijar el mismo rol que ya tiene no lanza", async () => {
    const t = convexTest(schema, modules);
    const { userId: callerId } = await issueTestActor(t, "owner");
    const employeeId = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-segura",
        role: "employee",
        mustChangePassword: false,
      }),
    );
    const ownerId = await t.run((ctx) =>
      createUser(ctx, {
        name: "Ana Torres",
        email: "ana@ejemplo.com",
        password: "contraseña-segura",
        role: "owner",
        mustChangePassword: false,
      }),
    );

    await t.run((ctx) => changeEmployeeRole(ctx, { userId: employeeId, role: "employee", callerId }));
    await t.run((ctx) => changeEmployeeRole(ctx, { userId: ownerId, role: "owner", callerId }));

    expect((await t.run((ctx) => ctx.db.get(employeeId)))?.role).toBe("employee");
    expect((await t.run((ctx) => ctx.db.get(ownerId)))?.role).toBe("owner");
  });

  test("el empleado recién ascendido puede usar de inmediato una acción de Dueña, con el mismo accessToken", async () => {
    const t = convexTest(schema, modules);
    const { userId: callerId } = await issueTestActor(t, "owner");
    const employeeId = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-segura",
        role: "employee",
        mustChangePassword: false,
      }),
    );
    const { token: sessionToken } = await t.mutation(api.sessions.login, {
      email: "carlos@ejemplo.com",
      password: "contraseña-segura",
    });
    const { accessToken } = await t.mutation(api.sessions.issueAccessToken, { token: sessionToken });

    const forbidden = await captureError(t.query(api.users.listEmployees, { token: accessToken }));
    expect(forbidden.data.code).toBe("FORBIDDEN");

    await t.run((ctx) => changeEmployeeRole(ctx, { userId: employeeId, role: "owner", callerId }));

    const employees = await t.query(api.users.listEmployees, { token: accessToken });
    expect(employees).toEqual([]);
  });
});
