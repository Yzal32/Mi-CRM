import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      // El paquete "server-only" solo resuelve a un no-op bajo la condición
      // de resolución "react-server", que solo entiende el bundler de
      // Next.js — fuera de él (aquí, en Vitest) su entrada por defecto
      // lanza a propósito ("This module cannot be imported from a Client
      // Component..."). Se alía directamente a su propio stub vacío para
      // poder testear módulos server-only (lib/auth/session.ts,
      // lib/convexServer.ts, proxy.ts) sin tocar cómo Next.js los bundlea
      // de verdad.
      "server-only": path.resolve(import.meta.dirname, "./node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
    server: { deps: { inline: ["convex-test"] } },
  },
});
