import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("users.updateEmail", () => {
  test("actualiza el email de un usuario existente", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.mutation(internal.users.provisionUser, {
      name: "Marta Gómez",
      email: "marta@ejemplo.com",
      password: "contraseña-temporal",
      role: "owner",
    });

    await t.mutation(internal.users.updateEmail, {
      userId,
      email: "marta.nueva@ejemplo.com",
    });

    const doc = await t.run((ctx) => ctx.db.get(userId));
    expect(doc?.email).toBe("marta.nueva@ejemplo.com");
  });

  test("recorta espacios y normaliza a minúsculas, igual que createUser", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.mutation(internal.users.provisionUser, {
      name: "Marta Gómez",
      email: "marta@ejemplo.com",
      password: "contraseña-temporal",
      role: "owner",
    });

    await t.mutation(internal.users.updateEmail, {
      userId,
      email: "  Marta.Nueva@Ejemplo.com  ",
    });

    const doc = await t.run((ctx) => ctx.db.get(userId));
    expect(doc?.email).toBe("marta.nueva@ejemplo.com");
  });

  test("no falla al 'actualizar' al mismo email que ya tenía el propio usuario", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.mutation(internal.users.provisionUser, {
      name: "Marta Gómez",
      email: "marta@ejemplo.com",
      password: "contraseña-temporal",
      role: "owner",
    });

    await t.mutation(internal.users.updateEmail, {
      userId,
      email: "marta@ejemplo.com",
    });

    const doc = await t.run((ctx) => ctx.db.get(userId));
    expect(doc?.email).toBe("marta@ejemplo.com");
  });

  test("USER_NOT_FOUND si el userId ya no existe", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.mutation(internal.users.provisionUser, {
      name: "Marta Gómez",
      email: "marta@ejemplo.com",
      password: "contraseña-temporal",
      role: "owner",
    });
    await t.run((ctx) => ctx.db.delete(userId));

    await expect(t.mutation(internal.users.updateEmail, { userId, email: "otra@ejemplo.com" })).rejects.toThrow(
      "Ese usuario ya no existe.",
    );
  });

  test("DUPLICATE_EMAIL si el email ya lo tiene otro usuario", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.users.provisionUser, {
      name: "Carlos Ruiz",
      email: "carlos@ejemplo.com",
      password: "contraseña-temporal",
      role: "employee",
    });
    const martaId = await t.mutation(internal.users.provisionUser, {
      name: "Marta Gómez",
      email: "marta@ejemplo.com",
      password: "contraseña-temporal",
      role: "owner",
    });

    await expect(
      t.mutation(internal.users.updateEmail, { userId: martaId, email: "carlos@ejemplo.com" }),
    ).rejects.toThrow("Ya hay una cuenta con ese email.");
  });

  test("INVALID_EMAIL con un formato claramente inválido", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.mutation(internal.users.provisionUser, {
      name: "Marta Gómez",
      email: "marta@ejemplo.com",
      password: "contraseña-temporal",
      role: "owner",
    });

    await expect(t.mutation(internal.users.updateEmail, { userId, email: "no-es-un-email" })).rejects.toThrow(
      "Ese email no es válido.",
    );
  });
});
