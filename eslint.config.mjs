import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Isomorphic code (lib/, template schemas) also ships to the browser: it
  // must never import server/ (secrets, database, Node-only APIs).
  {
    files: ["lib/**/*.{ts,tsx}", "templates/*/schema.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(?:@/server|(?:\\.\\./)+server)(?:/|$)",
              message:
                "lib/ and templates/*/schema.ts are isomorphic: never import server/ code.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated output:
    "scripts/dist/**",
    "coverage/**",
    ".vitest/**",
    ".data/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
