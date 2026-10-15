import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Isomorphic code (lib/, template schemas) also ships to the browser: it
// must never import server/ (secrets, database, Node-only APIs).
const serverImport = {
  regex: "^(?:@/server|(?:\\.\\./)+server)(?:/|$)",
  message:
    "lib/ and templates/*/schema.ts are isomorphic: never import server/ code.",
};
// Only repositories talk to Drizzle (global constraint). Schema, migrations
// and the seed live in server/db/; tests may query directly.
const drizzleImport = {
  regex: "^drizzle-orm(?:/|$)",
  message:
    "Only server/modules/*/repo.ts (and server/db/**) may import drizzle-orm. Call a repo function instead.",
};
// Routes validate, authorise and call a service; never a repo.
const repoImport = {
  regex: "^(?:\\./repo|@/server/modules/[^/]+/repo)$",
  message: "Routes call services, never repos.",
};

const restrict = (...patterns) => ({
  "no-restricted-imports": ["error", { patterns }],
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // A later block replaces the rule for the files it matches, so each block
  // lists every pattern that applies to its files.
  {
    files: ["**/*.{ts,tsx,mts}"],
    ignores: ["server/db/**", "server/modules/*/repo.ts", "tests/**"],
    rules: restrict(drizzleImport),
  },
  {
    files: ["lib/**/*.{ts,tsx}", "templates/*/schema.ts"],
    rules: restrict(serverImport, drizzleImport),
  },
  {
    files: ["server/modules/*/routes.ts"],
    rules: restrict(drizzleImport, repoImport),
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
