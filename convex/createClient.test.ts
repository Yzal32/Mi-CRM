import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { createClient } from "./model/clients";

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

describe("createClient", () => {
  test("alta con nombre y teléfono", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) => createClient(ctx, { name: "Carlos Ruiz", phone: "622 334 556" }));
    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.name).toBe("Carlos Ruiz");
    expect(doc?.phone).toBe("622 334 556");
    expect(doc?.phoneKey).toBe("622334556");
    expect(doc?.email).toBeUndefined();
  });

  test("alta solo con email (sin teléfono)", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) => createClient(ctx, { name: "Ana Torres", email: "Ana@Ejemplo.com" }));
    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.email).toBe("ana@ejemplo.com");
    expect(doc?.phone).toBeUndefined();
    expect(doc?.phoneKey).toBeUndefined();
  });

  test("nombre obligatorio", async () => {
    const t = convexTest(schema, modules);
    const error = await captureError(t.run((ctx) => createClient(ctx, { name: "   ", phone: "622334556" })));
    expect(error.data.code).toBe("NAME_REQUIRED");
  });

  test("nombre demasiado largo", async () => {
    const t = convexTest(schema, modules);
    const error = await captureError(
      t.run((ctx) => createClient(ctx, { name: "a".repeat(201), phone: "622334556" })),
    );
    expect(error.data.code).toBe("NAME_TOO_LONG");
  });

  test("teléfono o email obligatorio", async () => {
    const t = convexTest(schema, modules);
    const error = await captureError(t.run((ctx) => createClient(ctx, { name: "Cliente" })));
    expect(error.data.code).toBe("CONTACT_REQUIRED");
  });

  test("teléfono con letras se rechaza aunque haya un email válido", async () => {
    const t = convexTest(schema, modules);
    const error = await captureError(
      t.run((ctx) => createClient(ctx, { name: "Cliente", phone: "llámame", email: "cliente@ejemplo.com" })),
    );
    expect(error.data.code).toBe("INVALID_PHONE");
  });

  test("email con formato inválido se rechaza", async () => {
    const t = convexTest(schema, modules);
    const error = await captureError(
      t.run((ctx) => createClient(ctx, { name: "Cliente", email: "no-es-un-email" })),
    );
    expect(error.data.code).toBe("INVALID_EMAIL");
  });

  test("email demasiado largo se rechaza, no se trunca", async () => {
    const t = convexTest(schema, modules);
    const longEmail = `${"a".repeat(195)}@ej.com`; // > 200 caracteres
    const error = await captureError(t.run((ctx) => createClient(ctx, { name: "Cliente", email: longEmail })));
    expect(error.data.code).toBe("INVALID_EMAIL");
  });

  test("teléfono duplicado en formatos distintos se rechaza", async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) => createClient(ctx, { name: "Primero", phone: "622 334 556" }));

    const error = await captureError(
      t.run((ctx) => createClient(ctx, { name: "Segundo", phone: "+34622334556" })),
    );
    expect(error.data.code).toBe("DUPLICATE_PHONE");

    const error2 = await captureError(
      t.run((ctx) => createClient(ctx, { name: "Tercero", phone: "0034622334556" })),
    );
    expect(error2.data.code).toBe("DUPLICATE_PHONE");
  });

  test("dos altas sin teléfono (solo email) no chocan entre sí", async () => {
    const t = convexTest(schema, modules);
    const id1 = await t.run((ctx) => createClient(ctx, { name: "Uno", email: "uno@ejemplo.com" }));
    const id2 = await t.run((ctx) => createClient(ctx, { name: "Dos", email: "dos@ejemplo.com" }));
    expect(id1).not.toBe(id2);
  });

  test("status y originChannel usan sus valores por defecto cuando se omiten", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) => createClient(ctx, { name: "Cliente", phone: "622334556" }));
    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.status).toBe("new");
    expect(doc?.originChannel).toBe("web");
    expect(doc?.signupDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("status y originChannel explícitos se respetan", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) =>
      createClient(ctx, { name: "Cliente", phone: "622334556", status: "interested", originChannel: "referral" }),
    );
    const doc = await t.run((ctx) => ctx.db.get(id));
    expect(doc?.status).toBe("interested");
    expect(doc?.originChannel).toBe("referral");
  });
});
