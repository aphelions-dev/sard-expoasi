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
    // Los escriben los CLI de shadcn y mapcn: se envuelven, no se editan.
    "components/ui/**",
    // Copiado de node_modules por scripts/copiar-worker.mjs.
    "public/vendor/**",
  ]),
]);

export default eslintConfig;
