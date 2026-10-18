import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const CODE = "{ts,tsx,mts,cts,js,mjs,cjs}";

// Isomorphic code (lib/, template schemas and editor metadata, the template
// registry) also ships to the browser: it must never import server/
// (secrets, database, Node-only APIs) — statically, with import() or with
// require().
const SERVER_MESSAGE =
  "lib/ and templates/ schemas, editor metadata and registry are isomorphic: never import server/ code.";
const COMPUTED_MESSAGE =
  "Isomorphic code (lib/, templates/ schemas, editor metadata, registry) may not load modules by computed path (template-literal import()/require(), require.resolve, createRequire).";
const serverImport = {
  regex: "^(?:@/server|(?:\\.\\./)+server)(?:/|$)",
  message: SERVER_MESSAGE,
};
// esquery regex: character classes instead of "/" (probed, Phase 10 plan).
const SERVER_PATH = "/^(@[/]server|([.][.][/])+server)([/]|$)/";
const serverSyntax = [
  {
    selector: `ImportExpression[source.value=${SERVER_PATH}]`,
    message: SERVER_MESSAGE,
  },
  {
    selector: `CallExpression[callee.name='require'][arguments.0.value=${SERVER_PATH}]`,
    message: SERVER_MESSAGE,
  },
  // Paths the selectors above cannot read: banned outright in these files.
  {
    selector: "ImportExpression[source.type='TemplateLiteral']",
    message: COMPUTED_MESSAGE,
  },
  {
    selector:
      "CallExpression[callee.name='require'][arguments.0.type='TemplateLiteral']",
    message: COMPUTED_MESSAGE,
  },
  {
    selector:
      "MemberExpression[object.name='require'][property.name='resolve']",
    message: COMPUTED_MESSAGE,
  },
  { selector: "Identifier[name='createRequire']", message: COMPUTED_MESSAGE },
];
// Only repositories talk to Drizzle (global constraint). Schema, migrations
// and the seed live in server/db/; tests may query directly.
const drizzleImport = {
  regex: "^drizzle-orm(?:/|$)",
  message:
    "Only server/modules/*/repo.ts (and server/db/**) may import drizzle-orm. Call a repo function instead.",
};
// Routes validate, authorise and call a service; never a repo (any module's,
// by alias or relative path).
const repoImport = {
  regex:
    "^(?:\\.{1,2}/(?:[^/]+/)*repo|@/server/modules/[^/]+/repo)(?:\\.[cm]?[jt]s)?$",
  message: "Routes call services, never repos.",
};

const restrict = (...patterns) => ({
  "no-restricted-imports": ["error", { patterns }],
});

const ISOMORPHIC = [
  `lib/**/*.${CODE}`,
  "templates/*/schema.ts",
  "templates/*/editor-meta.ts",
  "templates/editor-meta.ts",
  "templates/registry.ts",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // A later block replaces the rule for the files it matches, so each block
  // lists every pattern that applies to its files.
  {
    files: [`**/*.${CODE}`],
    ignores: ["server/db/**", "server/modules/*/repo.ts", "tests/**"],
    rules: restrict(drizzleImport),
  },
  {
    files: ISOMORPHIC,
    rules: {
      ...restrict(serverImport, drizzleImport),
      "no-restricted-syntax": ["error", ...serverSyntax],
    },
  },
  // The typed admin API client needs the route *types* only (erased at
  // build): type-only imports of server/ are allowed in this one file.
  {
    files: ["lib/api-client.ts"],
    rules: {
      ...restrict(drizzleImport),
      "@typescript-eslint/no-restricted-imports": [
        "error",
        { patterns: [{ ...serverImport, allowTypeImports: true }] },
      ],
    },
  },
  {
    files: [`server/modules/*/routes.${CODE}`],
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
    // Agent worktrees (local scratch checkouts):
    ".claude/**",
  ]),
]);

export default eslintConfig;
