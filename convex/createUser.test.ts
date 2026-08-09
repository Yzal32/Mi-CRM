import { compareSync, getRounds } from "bcryptjs";
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { createUser } from "./model/users";

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

describe("createUser", () => {
  test("alta válida hashea la contraseña con bcrypt factor 10", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) =>
      createUser(ctx, {
        name: "Marta Gómez",
        email: "Marta@Ejemplo.com",
        password: "contraseña-segura",
        role: "owner",
        mustChangePassword: false,
      }),
    );
    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.passwordHash).not.toBe("contraseña-segura");
    expect(compareSync("contraseña-segura", doc!.passwordHash)).toBe(true);
    expect(getRounds(doc!.passwordHash)).toBe(10);
  });

  test("email se guarda en minúsculas", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) =>
      createUser(ctx, {
        name: "Marta Gómez",
        email: "Marta@Ejemplo.com",
        password: "contraseña-segura",
        role: "owner",
        mustChangePassword: false,
      }),
    );
    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.email).toBe("marta@ejemplo.com");
  });

  test("status siempre 'active' y createdDate con formato YYYY-MM-DD", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-segura",
        role: "employee",
        mustChangePassword: false,
      }),
    );
    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.status).toBe("active");
    expect(doc?.createdDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("mustChangePassword se guarda tal cual: true", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-segura",
        role: "employee",
        mustChangePassword: true,
      }),
    );
    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.mustChangePassword).toBe(true);
  });

  test("mustChangePassword se guarda tal cual: false", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-segura",
        role: "employee",
        mustChangePassword: false,
      }),
    );
    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.mustChangePassword).toBe(false);
  });

  test("rol 'owner' se guarda tal cual", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) =>
      createUser(ctx, {
        name: "Marta Gómez",
        email: "marta@ejemplo.com",
        password: "contraseña-segura",
        role: "owner",
        mustChangePassword: false,
      }),
    );
    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.role).toBe("owner");
  });

  test("rol 'employee' se guarda tal cual", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-segura",
        role: "employee",
        mustChangePassword: false,
      }),
    );
    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.role).toBe("employee");
  });

  test("nombre obligatorio", async () => {
    const t = convexTest(schema, modules);
    const error = await captureError(
      t.run((ctx) =>
        createUser(ctx, {
          name: "   ",
          email: "carlos@ejemplo.com",
          password: "contraseña-segura",
          role: "employee",
          mustChangePassword: false,
        }),
      ),
    );
    expect(error.data.code).toBe("NAME_REQUIRED");
  });

  test("nombre demasiado largo", async () => {
    const t = convexTest(schema, modules);
    const error = await captureError(
      t.run((ctx) =>
        createUser(ctx, {
          name: "a".repeat(201),
          email: "carlos@ejemplo.com",
          password: "contraseña-segura",
          role: "employee",
          mustChangePassword: false,
        }),
      ),
    );
    expect(error.data.code).toBe("NAME_TOO_LONG");
  });

  test("email obligatorio", async () => {
    const t = convexTest(schema, modules);
    const error = await captureError(
      t.run((ctx) =>
        createUser(ctx, {
          name: "Carlos Ruiz",
          email: "   ",
          password: "contraseña-segura",
          role: "employee",
          mustChangePassword: false,
        }),
      ),
    );
    expect(error.data.code).toBe("EMAIL_REQUIRED");
  });

  test("email con formato inválido se rechaza", async () => {
    const t = convexTest(schema, modules);
    const error = await captureError(
      t.run((ctx) =>
        createUser(ctx, {
          name: "Carlos Ruiz",
          email: "no-es-un-email",
          password: "contraseña-segura",
          role: "employee",
          mustChangePassword: false,
        }),
      ),
    );
    expect(error.data.code).toBe("INVALID_EMAIL");
  });

  test("email demasiado largo se rechaza, no se trunca", async () => {
    const t = convexTest(schema, modules);
    const longEmail = `${"a".repeat(195)}@ej.com`; // > 200 caracteres
    const error = await captureError(
      t.run((ctx) =>
        createUser(ctx, {
          name: "Carlos Ruiz",
          email: longEmail,
          password: "contraseña-segura",
          role: "employee",
          mustChangePassword: false,
        }),
      ),
    );
    expect(error.data.code).toBe("INVALID_EMAIL");
  });

  test("email duplicado se rechaza, incluso con distinta capitalización", async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) =>
      createUser(ctx, {
        name: "Marta Gómez",
        email: "Marta@Ejemplo.com",
        password: "contraseña-segura",
        role: "owner",
        mustChangePassword: false,
      }),
    );

    const error = await captureError(
      t.run((ctx) =>
        createUser(ctx, {
          name: "Otra Marta",
          email: "marta@ejemplo.com",
          password: "otra-contraseña",
          role: "employee",
          mustChangePassword: false,
        }),
      ),
    );
    expect(error.data.code).toBe("DUPLICATE_EMAIL");
  });

  test("dos altas con emails distintos no chocan entre sí", async () => {
    const t = convexTest(schema, modules);
    const id1 = await t.run((ctx) =>
      createUser(ctx, {
        name: "Marta Gómez",
        email: "marta@ejemplo.com",
        password: "contraseña-segura",
        role: "owner",
        mustChangePassword: false,
      }),
    );
    const id2 = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "contraseña-segura",
        role: "employee",
        mustChangePassword: false,
      }),
    );
    expect(id1).not.toBe(id2);
  });

  test("contraseña obligatoria", async () => {
    const t = convexTest(schema, modules);
    const error = await captureError(
      t.run((ctx) =>
        createUser(ctx, {
          name: "Carlos Ruiz",
          email: "carlos@ejemplo.com",
          password: "",
          role: "employee",
          mustChangePassword: false,
        }),
      ),
    );
    expect(error.data.code).toBe("PASSWORD_REQUIRED");
  });

  test("contraseña de 7 caracteres se rechaza (por debajo del mínimo)", async () => {
    const t = convexTest(schema, modules);
    const error = await captureError(
      t.run((ctx) =>
        createUser(ctx, {
          name: "Carlos Ruiz",
          email: "carlos@ejemplo.com",
          password: "a".repeat(7),
          role: "employee",
          mustChangePassword: false,
        }),
      ),
    );
    expect(error.data.code).toBe("PASSWORD_TOO_SHORT");
  });

  test("contraseña de 8 caracteres se acepta (frontera exacta del mínimo)", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "a".repeat(8),
        role: "employee",
        mustChangePassword: false,
      }),
    );
    expect(id).toBeTruthy();
  });

  test("contraseña de exactamente 72 bytes se acepta (frontera exacta de bcrypt)", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password: "a".repeat(72),
        role: "employee",
        mustChangePassword: false,
      }),
    );
    expect(id).toBeTruthy();
  });

  test("contraseña de 73 bytes se rechaza, no se trunca en silencio", async () => {
    const t = convexTest(schema, modules);
    const error = await captureError(
      t.run((ctx) =>
        createUser(ctx, {
          name: "Carlos Ruiz",
          email: "carlos@ejemplo.com",
          password: "a".repeat(73),
          role: "employee",
          mustChangePassword: false,
        }),
      ),
    );
    expect(error.data.code).toBe("PASSWORD_TOO_LONG");
  });

  test("contraseña con caracteres multibyte se rechaza si supera 72 bytes aunque tenga pocos caracteres visibles", async () => {
    const t = convexTest(schema, modules);
    // "🔒" ocupa 4 bytes UTF-8 y 2 unidades UTF-16 (par subrogado). 19
    // repeticiones = 76 bytes (>72) mostrando solo 19 caracteres visibles —
    // muy por debajo de "72 caracteres", pero por encima de "72 bytes".
    const error = await captureError(
      t.run((ctx) =>
        createUser(ctx, {
          name: "Carlos Ruiz",
          email: "carlos@ejemplo.com",
          password: "🔒".repeat(19),
          role: "employee",
          mustChangePassword: false,
        }),
      ),
    );
    expect(error.data.code).toBe("PASSWORD_TOO_LONG");
  });

  test("el mínimo de 8 se mide en unidades UTF-16 (password.length), no en caracteres visibles", async () => {
    const t = convexTest(schema, modules);
    // 4 emojis = 4 caracteres visibles, pero 8 unidades UTF-16 (cada uno es
    // un par subrogado) y solo 16 bytes UTF-8 — pasa el mínimo de longitud y
    // se queda muy por debajo del límite de 72 bytes.
    const password = "🔒".repeat(4);
    expect(password.length).toBe(8);
    const id = await t.run((ctx) =>
      createUser(ctx, {
        name: "Carlos Ruiz",
        email: "carlos@ejemplo.com",
        password,
        role: "employee",
        mustChangePassword: false,
      }),
    );
    expect(id).toBeTruthy();
  });
});
