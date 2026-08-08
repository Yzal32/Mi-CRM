/**
 * `import.meta.glob` es una extensión de Vite/Vitest usada por convex-test
 * (ver convex/*.test.ts) para descubrir los módulos de funciones de Convex
 * en las pruebas. El tsconfig de Convex no conoce los tipos de Vite — esta
 * declaración ambiental evita que `npx convex dev`/`codegen` falle al tipar
 * los archivos de test, sin depender del paquete "vite/client" completo.
 */
interface ImportMeta {
  glob(pattern: string): Record<string, () => Promise<unknown>>;
}
