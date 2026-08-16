import { convexTest, type TestConvex } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { createUser } from "./model/users";
import { issueTestAccessToken, issueTestActor } from "./testHelpers";

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

async function userByEmail(t: TestConvex<typeof schema>, email: string) {
  return t.run(async (ctx) =>
    ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique(),
  );
}

describe("users.create", () => {
  test("la Dueña crea un empleado: role 'employee', mustChangePassword true, status 'active'", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t, "owner");

    const id = await t.mutation(api.users.create, {
      token,
      name: "Carlos Ruiz",
      email: "carlos@ejemplo.com",
      password: "contraseña-segura",
    });

    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.role).toBe("employee");
    expect(doc?.mustChangePassword).toBe(true);
    expect(doc?.status).toBe("active");
  });

  test("el empleado recién creado puede iniciar sesión de inmediato", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t, "owner");
    await t.mutation(api.users.create, {
      token,
      name: "Carlos Ruiz",
      email: "carlos@ejemplo.com",
      password: "contraseña-segura",
    });

    const login = await t.mutation(api.sessions.login, { email: "carlos@ejemplo.com", password: "contraseña-segura" });
    expect(login.role).toBe("employee");
    expect(login.mustChangePassword).toBe(true);
  });

  test("email duplicado -> DUPLICATE_EMAIL", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t, "owner");
    await t.mutation(api.users.create, {
      token,
      name: "Carlos Ruiz",
      email: "carlos@ejemplo.com",
      password: "contraseña-segura",
    });

    const error = await captureError(
      t.mutation(api.users.create, { token, name: "Otro Carlos", email: "carlos@ejemplo.com", password: "otra-segura" }),
    );
    expect(error.data.code).toBe("DUPLICATE_EMAIL");
  });

  test("token inválido -> UNAUTHENTICATED", async () => {
    const t = convexTest(schema, modules);
    const error = await captureError(
      t.mutation(api.users.create, {
        token: "a".repeat(64),
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-segura",
      }),
    );
    expect(error.data.code).toBe("UNAUTHENTICATED");
  });

  test("un Empleado no puede dar de alta a otro -> FORBIDDEN, sin crear ningún usuario", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t, "employee");

    const error = await captureError(
      t.mutation(api.users.create, { token, name: "Carlos Ruiz", email: "carlos@ejemplo.com", password: "contraseña-segura" }),
    );
    expect(error.data.code).toBe("FORBIDDEN");
    expect(await userByEmail(t, "carlos@ejemplo.com")).toBeNull();
  });
});

describe("users.resetEmployeePassword", () => {
  test("la Dueña resetea la contraseña de un empleado y recibe una temporal", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t, "owner");
    const employeeId = await t.mutation(api.users.create, {
      token,
      name: "Carlos Ruiz",
      email: "carlos@ejemplo.com",
      password: "contraseña-segura",
    });

    const result = await t.mutation(api.users.resetEmployeePassword, { token, userId: employeeId });
    expect(result.temporaryPassword).toHaveLength(8);

    const login = await t.mutation(api.sessions.login, {
      email: "carlos@ejemplo.com",
      password: result.temporaryPassword,
    });
    expect(login.mustChangePassword).toBe(true);
  });

  test("token inválido -> UNAUTHENTICATED", async () => {
    const t = convexTest(schema, modules);
    // Id real (no una cadena inventada): igual criterio que el resto del
    // repo (ver followUps.test.ts) — así el rechazo es inequívocamente por
    // requireOwner/requireAccessToken, nunca por el validador de v.id() de
    // Convex actuando antes de llegar al handler.
    const employeeId = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-segura",
        role: "employee",
        mustChangePassword: false,
      }),
    );
    const error = await captureError(
      t.mutation(api.users.resetEmployeePassword, { token: "a".repeat(64), userId: employeeId }),
    );
    expect(error.data.code).toBe("UNAUTHENTICATED");
  });

  test("un Empleado no puede resetear la contraseña de otro -> FORBIDDEN, sin tocar la cuenta objetivo", async () => {
    const t = convexTest(schema, modules);
    // El objetivo se crea directamente con el helper de modelo (no vía
    // issueTestActor, que reusa siempre el mismo email fijo): issueTestActor
    // solo se llama UNA vez en este test, para el atacante — dos llamadas
    // con el mismo email chocarían entre sí con DUPLICATE_EMAIL.
    const employeeId = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-segura",
        role: "employee",
        mustChangePassword: false,
      }),
    );
    const { token: employeeSessionToken } = await t.mutation(api.sessions.login, {
      email: "carlos@ejemplo.com",
      password: "contraseña-segura",
    });
    const docBefore = await t.run((ctx) => ctx.db.get(employeeId));

    const attackerToken = await issueTestAccessToken(t, "employee");
    const error = await captureError(
      t.mutation(api.users.resetEmployeePassword, { token: attackerToken, userId: employeeId }),
    );
    expect(error.data.code).toBe("FORBIDDEN");

    const docAfter = await t.run((ctx) => ctx.db.get(employeeId));
    expect(docAfter?.passwordHash).toBe(docBefore?.passwordHash);
    expect(docAfter?.mustChangePassword).toBe(docBefore?.mustChangePassword);
    expect(await t.query(api.sessions.verify, { token: employeeSessionToken })).not.toBeNull();
  });
});

describe("users.deactivateEmployee", () => {
  test("la Dueña desactiva a un empleado -> status 'inactive'", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t, "owner");
    const employeeId = await t.mutation(api.users.create, {
      token,
      name: "Carlos Ruiz",
      email: "carlos@ejemplo.com",
      password: "contraseña-segura",
    });

    await t.mutation(api.users.deactivateEmployee, { token, userId: employeeId });

    const doc = await t.run((ctx) => ctx.db.get(employeeId));
    expect(doc?.status).toBe("inactive");
  });

  test("token inválido -> UNAUTHENTICATED", async () => {
    const t = convexTest(schema, modules);
    const employeeId = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-segura",
        role: "employee",
        mustChangePassword: false,
      }),
    );
    const error = await captureError(
      t.mutation(api.users.deactivateEmployee, { token: "a".repeat(64), userId: employeeId }),
    );
    expect(error.data.code).toBe("UNAUTHENTICATED");
  });

  test("un Empleado no puede desactivar a otro -> FORBIDDEN, sin tocar la cuenta objetivo", async () => {
    const t = convexTest(schema, modules);
    const employeeId = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-segura",
        role: "employee",
        mustChangePassword: false,
      }),
    );
    const { token: employeeSessionToken } = await t.mutation(api.sessions.login, {
      email: "carlos@ejemplo.com",
      password: "contraseña-segura",
    });
    const docBefore = await t.run((ctx) => ctx.db.get(employeeId));

    const attackerToken = await issueTestAccessToken(t, "employee");
    const error = await captureError(
      t.mutation(api.users.deactivateEmployee, { token: attackerToken, userId: employeeId }),
    );
    expect(error.data.code).toBe("FORBIDDEN");

    const docAfter = await t.run((ctx) => ctx.db.get(employeeId));
    expect(docAfter?.status).toBe(docBefore?.status);
    expect(await t.query(api.sessions.verify, { token: employeeSessionToken })).not.toBeNull();
  });
});

describe("users.reactivateEmployee", () => {
  test("la Dueña reactiva a un empleado -> status 'active'", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t, "owner");
    const employeeId = await t.mutation(api.users.create, {
      token,
      name: "Carlos Ruiz",
      email: "carlos@ejemplo.com",
      password: "contraseña-segura",
    });
    await t.mutation(api.users.deactivateEmployee, { token, userId: employeeId });

    await t.mutation(api.users.reactivateEmployee, { token, userId: employeeId });

    const doc = await t.run((ctx) => ctx.db.get(employeeId));
    expect(doc?.status).toBe("active");
  });

  test("token inválido -> UNAUTHENTICATED", async () => {
    const t = convexTest(schema, modules);
    const employeeId = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-segura",
        role: "employee",
        mustChangePassword: false,
      }),
    );
    const error = await captureError(
      t.mutation(api.users.reactivateEmployee, { token: "a".repeat(64), userId: employeeId }),
    );
    expect(error.data.code).toBe("UNAUTHENTICATED");
  });

  test("un Empleado no puede reactivar a otro -> FORBIDDEN, sin tocar la cuenta objetivo", async () => {
    const t = convexTest(schema, modules);
    const employeeId = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-segura",
        role: "employee",
        mustChangePassword: false,
      }),
    );
    await t.run((ctx) => ctx.db.patch(employeeId, { status: "inactive" }));

    const attackerToken = await issueTestAccessToken(t, "employee");
    const error = await captureError(
      t.mutation(api.users.reactivateEmployee, { token: attackerToken, userId: employeeId }),
    );
    expect(error.data.code).toBe("FORBIDDEN");

    const docAfter = await t.run((ctx) => ctx.db.get(employeeId));
    expect(docAfter?.status).toBe("inactive");
  });
});

describe("users.listEmployees", () => {
  test("la Dueña ve solo las cuentas 'employee', no su propia cuenta 'owner'", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t, "owner");
    await t.mutation(api.users.create, {
      token,
      name: "Carlos Ruiz",
      email: "carlos@ejemplo.com",
      password: "contraseña-segura",
    });

    const employees = await t.query(api.users.listEmployees, { token });

    expect(employees).toHaveLength(1);
    expect(employees[0].email).toBe("carlos@ejemplo.com");
    expect(employees.some((employee) => employee.email === "auth-helper@ejemplo.com")).toBe(false);
  });

  test("incluye status 'active' e 'inactive', sin passwordHash en el resultado", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t, "owner");
    const employeeId = await t.mutation(api.users.create, {
      token,
      name: "Carlos Ruiz",
      email: "carlos@ejemplo.com",
      password: "contraseña-segura",
    });
    await t.mutation(api.users.deactivateEmployee, { token, userId: employeeId });

    const employees = await t.query(api.users.listEmployees, { token });

    expect(employees[0].status).toBe("inactive");
    expect(Object.keys(employees[0])).not.toContain("passwordHash");
  });

  test("token inválido -> UNAUTHENTICATED", async () => {
    const t = convexTest(schema, modules);
    const error = await captureError(t.query(api.users.listEmployees, { token: "a".repeat(64) }));
    expect(error.data.code).toBe("UNAUTHENTICATED");
  });

  test("un Empleado no puede listar -> FORBIDDEN", async () => {
    const t = convexTest(schema, modules);
    const attackerToken = await issueTestAccessToken(t, "employee");
    const error = await captureError(t.query(api.users.listEmployees, { token: attackerToken }));
    expect(error.data.code).toBe("FORBIDDEN");
  });
});

describe("users.changeEmployeeRole", () => {
  test("la Dueña asciende a un empleado -> role 'owner'", async () => {
    const t = convexTest(schema, modules);
    const token = await issueTestAccessToken(t, "owner");
    const employeeId = await t.mutation(api.users.create, {
      token,
      name: "Carlos Ruiz",
      email: "carlos@ejemplo.com",
      password: "contraseña-segura",
    });

    await t.mutation(api.users.changeEmployeeRole, { token, userId: employeeId, role: "owner" });

    const doc = await t.run((ctx) => ctx.db.get(employeeId));
    expect(doc?.role).toBe("owner");
  });

  test("token inválido -> UNAUTHENTICATED", async () => {
    const t = convexTest(schema, modules);
    const employeeId = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-segura",
        role: "employee",
        mustChangePassword: false,
      }),
    );
    const error = await captureError(
      t.mutation(api.users.changeEmployeeRole, { token: "a".repeat(64), userId: employeeId, role: "owner" }),
    );
    expect(error.data.code).toBe("UNAUTHENTICATED");
  });

  test("un Empleado no puede cambiar el rol de otro -> FORBIDDEN, sin tocar la cuenta objetivo", async () => {
    const t = convexTest(schema, modules);
    const employeeId = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-segura",
        role: "employee",
        mustChangePassword: false,
      }),
    );
    const { token: employeeSessionToken } = await t.mutation(api.sessions.login, {
      email: "carlos@ejemplo.com",
      password: "contraseña-segura",
    });

    const attackerToken = await issueTestAccessToken(t, "employee");
    const error = await captureError(
      t.mutation(api.users.changeEmployeeRole, { token: attackerToken, userId: employeeId, role: "owner" }),
    );
    expect(error.data.code).toBe("FORBIDDEN");

    const docAfter = await t.run((ctx) => ctx.db.get(employeeId));
    expect(docAfter?.role).toBe("employee");
    expect(await t.query(api.sessions.verify, { token: employeeSessionToken })).not.toBeNull();
  });

  test("la Dueña no puede cambiar su propio rol -> CANNOT_CHANGE_OWN_ROLE", async () => {
    const t = convexTest(schema, modules);
    const { accessToken: token, userId: ownerId } = await issueTestActor(t, "owner");

    const error = await captureError(
      t.mutation(api.users.changeEmployeeRole, { token, userId: ownerId, role: "employee" }),
    );
    expect(error.data.code).toBe("CANNOT_CHANGE_OWN_ROLE");

    const docAfter = await t.run((ctx) => ctx.db.get(ownerId));
    expect(docAfter?.role).toBe("owner");
  });
});
