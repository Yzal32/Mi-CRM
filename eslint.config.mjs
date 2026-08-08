import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Código autogenerado por `npx convex dev` — no es código fuente propio.
    "convex/_generated/**",
    // Paquete de diseño de referencia (prototipos .dc.html/.js de un editor
    // visual externo, no código de producción) — ver desing/diseño pantalla
    // crm/design_handoff_crm_loop/README.md.
    "desing/**",
  ]),
]);

export default eslintConfig;
