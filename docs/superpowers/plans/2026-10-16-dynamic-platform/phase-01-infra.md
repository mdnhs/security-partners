# Phase 1 — Infrastructure

> Part of `docs/superpowers/plans/2026-10-16-dynamic-platform.md` (master, Phase 1 = Tasks 1.1–1.6). Spec: `docs/superpowers/specs/2026-10-16-dynamic-platform-design.md` (§2, §3, §4, §7, §13, §14, §15). Branch `feat/dynamic-platform`. Never push.
>
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Global constraints that bind this phase**

- Env vars: exactly `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (plus platform `NODE_ENV`, `PORT`, `HOSTNAME`). Nothing else is read by app code. (Tests may read `TEST_DATABASE_URL`; tests only.)
- `next build` must succeed with no env vars and no database. Nothing reads env or opens a DB connection at import time.
- Every file under `server/` starts with `import "server-only"` (first non-comment line). Pinned by `tests/unit/server-only-guard.test.ts` (Task 2).
- `lib/**` and `templates/*/schema.ts` never import `server/**` (ESLint `no-restricted-imports`, Task 1).
- Repos are the only files that import Drizzle query builders. Phase 1 has no repos; `server/db/client.ts` (ping) and `server/db/migrate.ts` (migrator) are infrastructure, not repos.
- IDs uuid v7, timestamps `timestamptz` (helpers in `server/db/schema/_shared.ts`).
- Error envelope `{ error: { code, message, fieldErrors?, requestId } }`, codes `VALIDATION_FAILED | UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | CONFLICT | RATE_LIMITED | INTERNAL`.
- Body limits: public 64 KB, admin 1 MB, upload 20 MB.
- Library versions exact (Tech Stack / notes); no RC/beta. Install with `--save-exact`.
- Code style: Prettier config in repo (no semicolons, double quotes). `eslint.config.mjs` keeps its existing semicolon style.
- Commit after every task; message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never `git push`.
- Phase ends green: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Phase 0 runs in parallel and owns `playwright.config.ts`, `tests/visual/**`, `docs/brief*`, `scripts/check-inventory.ts`; it adds `@playwright/test` + `test:visual*` scripts to `package.json` and `test-results/`, `playwright-report/`, `.data/` to `.gitignore`. This phase only *adds* keys to `package.json` (via `pnpm add` / `pnpm pkg set`, never by rewriting the file) and only *appends* to `.gitignore`.

**How `server-only` is handled outside Next** (the master's "as documented in the Phase 1 plan"):

| Runner | Mechanism | File |
|---|---|---|
| Next (`next dev/build/start`) | native: route handlers/RSC resolve `server-only` with the `react-server` condition → empty module | — |
| Vitest | `resolve.alias: { "server-only": tests/stubs/server-only.ts }` | `vitest.config.ts` |
| tsx scripts (`pnpm tsx:server <file>`) and drizzle-kit | Node `module.registerHooks` resolve hook mapping only the `server-only` specifier to the package's own `empty.js` (preloaded with `--import`) | `scripts/register-server-only.mjs` |
| Bundled scripts in the image (`scripts/dist/*.mjs`) | esbuild plugin resolving `server-only` to an empty module | `scripts/build-scripts.ts` |

Do **not** use `--conditions=react-server` globally: it would also switch `react-dom/server` to its RSC build, which throws (breaks React Email rendering in Phase 2+ scripts). All four mechanisms were verified in a throwaway probe against the exact versions below.

## Corrections to master plan

- Task 1.1 installs only the Phase 1 dependencies (hono, @hono/zod-validator, zod, drizzle-orm, pg, uuidv7, server-only; dev: drizzle-kit, @types/pg, vitest, vite, tsx, esbuild, @types/node 22); each later phase installs its own Tech Stack packages at the versions in `docs/superpowers/notes/libraries-api.md` — why: planner rule "fold setup into the task that needs it", no unused deps for 9 phases — cost if wrong: none (later phase plans already list their installs).
- `KeyPurpose` is `"secrets" | "preview" | "lead-ip" | "cron"` — ledger ruling (scheduler → internal revalidate route HMAC) — cost: none.
- `lib/auth/roles.ts` (`ROLES`, `Role`, exactly as Shared contracts) is created in Task 1.3 because `Actor.roles: Role[]` needs it; Task 2.1 then creates only `lib/auth/permissions.ts` and must not change `roles.ts` — cost: none.
- Bundled scripts are `scripts/dist/<name>.mjs` (not `.js`); entrypoint runs `node scripts/dist/migrate.mjs` — why: the bundle is ESM with top-level await and must not depend on a `package.json` `"type"` next to it in the image — cost: none.
- The container entrypoint is `/app/docker-entrypoint.sh` (`ENTRYPOINT`) with `CMD ["node","server.js"]` and `exec "$@"` — why: the `node` base image already owns `/usr/local/bin/docker-entrypoint.sh` — cost: none.
- `scripts/migrate.ts` validates all three env vars via `getEnv()` before migrating — why: spec §13 "env validated at startup"; a misconfigured container fails at start with the readable list — cost: `pnpm db:migrate` needs all three vars (present in `.env.development`).
- Integration helpers split: `tests/integration/global-setup.ts` (connect-or-fail-loudly + migrate once), `tests/integration/setup.ts` (per-file env + `closeDb`), `tests/integration/db.ts` (`TEST_DATABASE_URL`, `resetDb()`); master listed only `setup.ts` — cost: none (later phases import `resetDb` from `tests/integration/db.ts`).
- `server/db/client.ts` also exports `closeDb()` and `pingDb()`; `getDb()` memoises per `DATABASE_URL` value (a changed URL gets a new pool) — needed for scripts/tests and the 503 readiness test — cost: none.
- `zv` lives in new file `server/api/validate.ts`; `fieldErrors` keys are dot-joined Zod paths (`"hero.heading"`, `"items.2.label"`, root issues under `"_root"`) via `fieldErrorsFromIssues()` in `server/lib/errors.ts` — needed by Task 4.2 "fieldErrors paths" — cost: none.
- Error envelope extensions: 409 `CONFLICT` carries `error.current` (Review Focus 2); body-limit 413 uses code `VALIDATION_FAILED` (fixed code list has no payload code) — cost: none.
- `X-Robots-Tag: noindex` for `/api/*` is set by app-level Hono middleware in Task 1.5 (ledger ruling assigns it to Hono; 2.5 only verifies it); `sameOrigin` + body limits are mounted on `/api/v1/admin/*` and `/api/v1/public/*` now; Task 2.3 inserts `sessionMiddleware`/`requireSignedIn` *before* `sameOrigin` — cost: none.
- `export const adminRoutes = new Hono<AppEnv>()` (empty) and `export type AdminApi = typeof adminRoutes` exist from Task 1.5, mounted at `/api/v1/admin`; later phases turn it into a chained `.route()` expression — cost: none.
- Local dev env lives in `.env.development` (copied from committed `.env.example`, gitignored): `next dev` and `pnpm tsx:server` read it, `next build`/`next start` never do — why: keeps local `pnpm build` env-free — cost: Phase 3+ visual/E2E runs against `next start` must pass DB env through Playwright `webServer.env`.
- `getSiteEnv` precedence follows spec §1.4 order literally: production-origin match first, then `NODE_ENV !== "production"` → development, else staging — cost: none.

---

### Task 1: Dependencies, scripts, lint boundaries (master Task 1.1)

**Files:**
- Modify: `package.json` (deps + scripts, via `pnpm add` / `pnpm pkg set`)
- Modify: `pnpm-workspace.yaml` (allow `esbuild` build script)
- Modify: `eslint.config.mjs`
- Modify: `tsconfig.json` (target ES2022, exclude `scripts/dist`)
- Modify: `.gitignore` (append `/.vitest/`)
- Create: `vitest.config.ts`
- Create: `tests/unit/setup.ts`
- Create: `tests/stubs/server-only.ts`
- Test: `tests/unit/lint-boundaries.test.ts`

**Interfaces:**
- Consumes: nothing from earlier phases.
- Produces: scripts `test` (`vitest run`), `test:unit`, `test:integration`, `test:watch`; Vitest project `unit` (node env, `tests/unit/**/*.test.{ts,tsx}`, setup `tests/unit/setup.ts`); `server-only` alias for Vitest; ESLint boundary rule on `lib/**/*.{ts,tsx}` and `templates/*/schema.ts` rejecting `@/server`, `@/server/...`, `../server/...` (any depth).

- [ ] **Step 1: Install Phase 1 dependencies (exact versions)**

```bash
pnpm add --save-exact hono@4.13.13 @hono/zod-validator@0.9.1 zod@4.6.7 drizzle-orm@0.45.4 pg@8.23.1 uuidv7@1.2.1 server-only@0.0.1
pnpm add -D --save-exact drizzle-kit@0.31.11 @types/pg@8.23.1 vitest@5.0.5 vite@8.3.4 tsx@4.23.15 esbuild@0.28.2 @types/node@22.20.5
```

Then edit `pnpm-workspace.yaml` to exactly:

```yaml
packages: []

allowBuilds:
  esbuild: true
  sharp: true
  unrs-resolver: true
  msw: false
```

and run `pnpm install` (lets esbuild's postinstall run; no "ignored build scripts" warning for esbuild).

- [ ] **Step 2: Add test scripts**

```bash
pnpm pkg set scripts.test="vitest run"
pnpm pkg set scripts.test:unit="vitest run --project unit"
pnpm pkg set scripts.test:integration="vitest run --project integration"
pnpm pkg set scripts.test:watch="vitest --project unit"
```

(`test:integration` matches no project until Task 4; that is expected.)

- [ ] **Step 3: Vitest config, unit setup, server-only stub**

`vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

const serverOnlyStub = fileURLToPath(
  new URL("./tests/stubs/server-only.ts", import.meta.url)
)

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // `server-only` throws outside Next's react-server bundles.
    alias: { "server-only": serverOnlyStub },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
          setupFiles: ["./tests/unit/setup.ts"],
        },
      },
    ],
  },
})
```

`tests/unit/setup.ts`:

```ts
// Unit tests must not depend on the developer's shell: drop app env vars.
// Tests that need them set them explicitly (see tests/unit/env.test.ts).
for (const key of ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"])
  delete process.env[key]
```

`tests/stubs/server-only.ts`:

```ts
// Vitest alias target for `server-only` (see vitest.config.ts).
export {}
```

Note: `include` is restricted to `tests/unit/**` on purpose — Phase 0's Playwright specs (`tests/visual/**/*.spec.ts`) must never be picked up by Vitest.

- [ ] **Step 4: Write the failing lint-boundary test**

`tests/unit/lint-boundaries.test.ts`:

```ts
import { ESLint } from "eslint"
import { describe, expect, it } from "vitest"

// Runs the real eslint.config.mjs against inline sources (files need not exist).
const eslint = new ESLint({ cwd: process.cwd() })

async function boundaryErrors(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath })
  return result.messages.filter((m) => m.ruleId === "no-restricted-imports")
}

const aliasImport =
  'import { getEnv } from "@/server/env"\n\nexport const x = getEnv\n'

describe(
  "lint boundaries: lib/ and templates/*/schema.ts never import server/",
  { timeout: 30_000 },
  () => {
    it("flags @/server/... imported from lib/", async () => {
      const errors = await boundaryErrors(aliasImport, "lib/auth/fixture.ts")
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toContain("never import server/ code")
    })

    it("flags a bare @/server import from lib/", async () => {
      const errors = await boundaryErrors(
        'export * from "@/server"\n',
        "lib/fixture.ts"
      )
      expect(errors).toHaveLength(1)
    })

    it("flags relative ../server imports from lib/", async () => {
      const errors = await boundaryErrors(
        'import { getEnv } from "../server/env"\n\nexport const x = getEnv\n',
        "lib/fixture.ts"
      )
      expect(errors).toHaveLength(1)
    })

    it("flags server imports from templates/*/schema.ts", async () => {
      const errors = await boundaryErrors(
        'import { getEnv } from "../../server/env"\n\nexport const x = getEnv\n',
        "templates/home/schema.ts"
      )
      expect(errors).toHaveLength(1)
    })

    it("allows lib/ to import lib/ and look-alike names", async () => {
      expect(
        await boundaryErrors(
          'import { cn } from "@/lib/utils"\n\nexport const x = cn\n',
          "lib/fixture.ts"
        )
      ).toEqual([])
      expect(
        await boundaryErrors(
          'import { y } from "@/server-utils"\n\nexport const x = y\n',
          "lib/fixture.ts"
        )
      ).toEqual([])
    })

    it("does not restrict other folders (components/ may import server/)", async () => {
      expect(
        await boundaryErrors(aliasImport, "components/fixture.ts")
      ).toEqual([])
    })
  }
)
```

- [ ] **Step 5: Run it to verify it fails**

Run: `pnpm test:unit`
Expected: FAIL — 4 tests fail with `expected [] to have a length of 1 but got +0` (the rule does not exist yet); the two "allows"/"does not restrict" tests pass.

- [ ] **Step 6: Add the ESLint boundary rule and ignores**

`eslint.config.mjs` (full file):

```js
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
```

- [ ] **Step 7: tsconfig target + exclude**

In `tsconfig.json` change `"target": "ES2017"` → `"target": "ES2022"` and `"exclude": ["node_modules"]` → `"exclude": ["node_modules", "scripts/dist"]`. Nothing else changes.

Append to `.gitignore` (only if the line is missing):

```bash
grep -qxF '/.vitest/' .gitignore || printf '\n# vitest\n/.vitest/\n' >> .gitignore
```

- [ ] **Step 8: Run tests, lint, typecheck**

Run: `pnpm test:unit`
Expected: PASS — 6 tests in `tests/unit/lint-boundaries.test.ts`.

Run: `pnpm test`
Expected: PASS (same 6 tests; only the unit project exists).

Run: `pnpm lint && pnpm typecheck`
Expected: both exit 0.

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml eslint.config.mjs tsconfig.json .gitignore vitest.config.ts tests/unit/setup.ts tests/stubs/server-only.ts tests/unit/lint-boundaries.test.ts
git commit -m "chore: add infra dependencies, vitest and lint boundaries

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Env + site env (master Task 1.2)

**Files:**
- Create: `server/env.ts`
- Create: `server/lib/site-env.ts`
- Test: `tests/unit/env.test.ts`
- Test: `tests/unit/server-only-guard.test.ts`

**Interfaces:**
- Consumes: Vitest unit project + `server-only` alias (Task 1).
- Produces:
  - `export type Env = { DATABASE_URL: string; BETTER_AUTH_SECRET: string; BETTER_AUTH_URL: string; NODE_ENV: "development" | "production" | "test" }`
  - `export function parseEnv(source: Record<string, string | undefined>): Env` (pure; throws one multi-line `Error`)
  - `export function getEnv(): Env` (lazy; memoised on the current values of the 4 keys; re-validates when they change)
  - `export type SiteEnv = "development" | "staging" | "production"`
  - `export function getSiteEnv(productionUrl?: string): SiteEnv`
- Error message format (later phases and the container log rely on it):

```
Invalid environment configuration:
  - DATABASE_URL: is required
  - BETTER_AUTH_SECRET: must be at least 32 characters
  - BETTER_AUTH_URL: must be an absolute http(s) URL
Set these variables before starting the server (see .env.example).
```

- [ ] **Step 1: Write the failing tests**

`tests/unit/env.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest"

import { getEnv, parseEnv } from "@/server/env"
import { getSiteEnv } from "@/server/lib/site-env"

const VALID = {
  DATABASE_URL: "postgres://sp:sp@127.0.0.1:5432/sp_dev",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "https://staging.example.ie",
  NODE_ENV: "production",
}

const KEYS = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "NODE_ENV",
] as const
// Next types NODE_ENV as read-only; tests need to set it.
const ENV = process.env as Record<string, string | undefined>
const saved = Object.fromEntries(KEYS.map((k) => [k, ENV[k]]))

function setEnv(values: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const k of KEYS) {
    if (values[k] === undefined) delete ENV[k]
    else ENV[k] = values[k]
  }
}

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete ENV[k]
    else ENV[k] = saved[k]
  }
})

describe("parseEnv", () => {
  it("accepts a valid env and defaults NODE_ENV to development", () => {
    const env = parseEnv({ ...VALID, NODE_ENV: undefined })
    expect(env).toEqual({ ...VALID, NODE_ENV: "development" })
  })

  it("names every missing variable in one multi-line error", () => {
    expect(() => parseEnv({})).toThrowError(
      [
        "Invalid environment configuration:",
        "  - DATABASE_URL: is required",
        "  - BETTER_AUTH_SECRET: is required",
        "  - BETTER_AUTH_URL: is required",
        "Set these variables before starting the server (see .env.example).",
      ].join("\n")
    )
  })

  it("treats empty strings as missing", () => {
    expect(() => parseEnv({ ...VALID, DATABASE_URL: "" })).toThrowError(
      "  - DATABASE_URL: is required"
    )
  })

  it("rejects a BETTER_AUTH_SECRET shorter than 32 characters without echoing it", () => {
    let message = ""
    try {
      parseEnv({ ...VALID, BETTER_AUTH_SECRET: "short-secret-value" })
    } catch (err) {
      message = (err as Error).message
    }
    expect(message).toContain(
      "  - BETTER_AUTH_SECRET: must be at least 32 characters"
    )
    expect(message).not.toContain("short-secret-value")
  })

  it.each(["localhost:3000", "/admin", "ftp://example.ie", "not a url"])(
    "rejects BETTER_AUTH_URL %s (must be absolute http(s))",
    (value) => {
      expect(() => parseEnv({ ...VALID, BETTER_AUTH_URL: value })).toThrowError(
        "  - BETTER_AUTH_URL: must be an absolute http(s) URL"
      )
    }
  )

  it("accepts http and https BETTER_AUTH_URL", () => {
    expect(
      parseEnv({ ...VALID, BETTER_AUTH_URL: "http://localhost:3000" })
        .BETTER_AUTH_URL
    ).toBe("http://localhost:3000")
    expect(parseEnv(VALID).BETTER_AUTH_URL).toBe("https://staging.example.ie")
  })

  it("rejects a non-postgres DATABASE_URL", () => {
    expect(() =>
      parseEnv({ ...VALID, DATABASE_URL: "mysql://x@y/z" })
    ).toThrowError(
      "  - DATABASE_URL: must be a postgres:// or postgresql:// URL"
    )
  })

  it("lists several invalid vars at once", () => {
    let message = ""
    try {
      parseEnv({
        DATABASE_URL: VALID.DATABASE_URL,
        BETTER_AUTH_SECRET: "x",
        BETTER_AUTH_URL: "nope",
      })
    } catch (err) {
      message = (err as Error).message
    }
    expect(message.split("\n").filter((l) => l.startsWith("  - "))).toEqual([
      "  - BETTER_AUTH_SECRET: must be at least 32 characters",
      "  - BETTER_AUTH_URL: must be an absolute http(s) URL",
    ])
  })
})

describe("getEnv", () => {
  it("reads process.env lazily and re-validates when it changes", () => {
    setEnv({})
    expect(() => getEnv()).toThrowError(/DATABASE_URL: is required/)
    setEnv(VALID)
    expect(getEnv().BETTER_AUTH_URL).toBe("https://staging.example.ie")
    expect(getEnv()).toBe(getEnv())
    setEnv({ ...VALID, BETTER_AUTH_URL: "https://www.example.ie" })
    expect(getEnv().BETTER_AUTH_URL).toBe("https://www.example.ie")
  })
})

describe("getSiteEnv (spec §1.4)", () => {
  it("is production when the BETTER_AUTH_URL origin equals settings.site.productionUrl", () => {
    setEnv({ ...VALID, BETTER_AUTH_URL: "https://www.example.ie/" })
    expect(getSiteEnv("https://www.example.ie")).toBe("production")
  })

  it("is development when NODE_ENV is not production", () => {
    setEnv({ ...VALID, NODE_ENV: "development" })
    expect(getSiteEnv("https://www.example.ie")).toBe("development")
    setEnv({ ...VALID, NODE_ENV: undefined })
    expect(getSiteEnv()).toBe("development")
  })

  it("is staging for a production build on any other origin", () => {
    setEnv(VALID)
    expect(getSiteEnv("https://www.example.ie")).toBe("staging")
    expect(getSiteEnv()).toBe("staging")
    expect(getSiteEnv("not a url")).toBe("staging")
  })
})
```

`tests/unit/server-only-guard.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory())
      return entry.name === "migrations" ? [] : walk(path)
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : []
  })
}

describe('every file under server/ starts with import "server-only"', () => {
  const files = walk("server")

  it("finds server files", () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)("%s", (file) => {
    const firstStatement = readFileSync(file, "utf8")
      .split("\n")
      .find((line) => line.trim() !== "" && !line.trim().startsWith("//"))
    expect(firstStatement).toBe('import "server-only"')
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test:unit tests/unit/env.test.ts tests/unit/server-only-guard.test.ts`
Expected: FAIL — `env.test.ts`: `Failed to resolve import "@/server/env"`; `server-only-guard.test.ts`: `ENOENT: no such file or directory, scandir 'server'`.

- [ ] **Step 3: Implement `server/env.ts`**

```ts
import "server-only"

import { z } from "zod"

const NODE_ENVS = ["development", "production", "test"] as const

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

const isPostgresUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === "postgres:" || url.protocol === "postgresql:"
  } catch {
    return false
  }
}

const envSchema = z.object({
  DATABASE_URL: z
    .string({ error: "is required" })
    .min(1, "is required")
    .refine(isPostgresUrl, "must be a postgres:// or postgresql:// URL"),
  BETTER_AUTH_SECRET: z
    .string({ error: "is required" })
    .min(1, "is required")
    .min(32, "must be at least 32 characters"),
  BETTER_AUTH_URL: z
    .string({ error: "is required" })
    .min(1, "is required")
    .refine(isHttpUrl, "must be an absolute http(s) URL"),
  NODE_ENV: z.enum(NODE_ENVS).default("development"),
})

export type Env = z.infer<typeof envSchema>

const KEYS = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "NODE_ENV",
] as const

/** Validates an env source. Throws one readable error listing every bad var (values are never echoed). */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const input: Record<string, string | undefined> = {}
  for (const key of KEYS) {
    const value = source[key]
    input[key] = value === "" ? undefined : value
  }
  const result = envSchema.safeParse(input)
  if (result.success) return result.data
  const firstIssue = new Map<string, string>()
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "env")
    if (!firstIssue.has(key)) firstIssue.set(key, issue.message)
  }
  const lines = [...firstIssue].map(
    ([key, message]) => `  - ${key}: ${message}`
  )
  throw new Error(
    [
      "Invalid environment configuration:",
      ...lines,
      "Set these variables before starting the server (see .env.example).",
    ].join("\n")
  )
}

let cache: { signature: string; env: Env } | undefined

/** Lazy, memoised. Never call at module scope: `next build` runs without env vars. */
export function getEnv(): Env {
  const signature = KEYS.map((key) => process.env[key] ?? "").join("\u0000")
  if (cache?.signature === signature) return cache.env
  const env = parseEnv(process.env)
  cache = { signature, env }
  return env
}
```

- [ ] **Step 4: Implement `server/lib/site-env.ts`**

```ts
import "server-only"

import { getEnv } from "@/server/env"

export type SiteEnv = "development" | "staging" | "production"

const originOf = (value: string | undefined) => {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

/**
 * Spec §1.4: "production" when the BETTER_AUTH_URL origin equals
 * settings.site.productionUrl; "development" when NODE_ENV !== "production";
 * otherwise "staging". Callers pass settings.site.productionUrl.
 */
export function getSiteEnv(productionUrl?: string): SiteEnv {
  const env = getEnv()
  const production = originOf(productionUrl)
  if (production !== null && production === originOf(env.BETTER_AUTH_URL))
    return "production"
  if (env.NODE_ENV !== "production") return "development"
  return "staging"
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:unit`
Expected: PASS — `env.test.ts` (15 tests), `server-only-guard.test.ts` (3 tests: finds files + `server/env.ts` + `server/lib/site-env.ts`), `lint-boundaries.test.ts` (6).

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add server/env.ts server/lib/site-env.ts tests/unit/env.test.ts tests/unit/server-only-guard.test.ts
git commit -m "feat: add validated env and site env derivation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Crypto + errors + actor (master Task 1.3)

**Files:**
- Create: `lib/auth/roles.ts`
- Create: `server/lib/actor.ts`
- Create: `server/lib/errors.ts`
- Create: `server/lib/crypto.ts`
- Test: `tests/unit/crypto.test.ts`
- Test: `tests/unit/errors.test.ts`

**Interfaces:**
- Consumes: `getEnv()` (Task 2) for the default secret.
- Produces (exact Shared contracts, plus the additions marked ⁺):

```ts
// lib/auth/roles.ts
export const ROLES = ["owner", "admin", "editor", "author", "marketer", "intake", "viewer"] as const
export type Role = (typeof ROLES)[number]

// server/lib/actor.ts
export type Actor = { userId: string; roles: Role[]; ip: string | null; userAgent: string | null; impersonatorId: string | null }

// server/lib/errors.ts
export const ERROR_CODES: readonly ["VALIDATION_FAILED","UNAUTHENTICATED","FORBIDDEN","NOT_FOUND","CONFLICT","RATE_LIMITED","INTERNAL"]
export type ErrorCode
export const STATUS_BY_CODE ⁺ // { VALIDATION_FAILED: 422, UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, RATE_LIMITED: 429, INTERNAL: 500 }
export type ErrorDetails ⁺ = { fieldErrors?: Record<string, string[]>; current?: unknown }
export class AppError extends Error { readonly code: ErrorCode; readonly details?: ErrorDetails; constructor(code, message, details?); get status() }
export const notFound: (what: string) => AppError      // message "<what> not found"
export const forbidden: () => AppError
export const conflict: (current: unknown) => AppError  // details.current = current
export function fieldErrorsFromIssues ⁺ (issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>): Record<string, string[]>

// server/lib/crypto.ts
export type KeyPurpose = "secrets" | "preview" | "lead-ip" | "cron"
export function deriveKey(purpose: KeyPurpose, secret?: string): Buffer          // HKDF-SHA256, salt "sp/v1", info = purpose, 32 bytes
export function encryptSecret(plain: string, aad: string, secret?: string): string // "v1:<iv>:<ct>:<tag>" base64url, AES-256-GCM, 12-byte IV
export function decryptSecret(token: string, aad: string, secret?: string): string // throws on wrong AAD/secret/tamper/malformed
export function secretHint(plain: string): string                                 // "••••" + last 4; "••••" when length ≤ 4
```

`secret` defaults to `getEnv().BETTER_AUTH_SECRET`. Encryption always uses the `secrets` purpose key; other purposes are for HMAC/tokens in later phases (`preview` 4.4, `lead-ip` 7.3, `cron` 5.4).

- [ ] **Step 1: Write the failing tests**

`tests/unit/crypto.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  decryptSecret,
  deriveKey,
  encryptSecret,
  secretHint,
} from "@/server/lib/crypto"

const SECRET = "test-secret-0123456789abcdef0123456789abcdef"
const OTHER = "other-secret-0123456789abcdef0123456789abcdef"
const AAD = "integrations.smtp.password"

describe("deriveKey", () => {
  it("is deterministic per purpose and 32 bytes long", () => {
    expect(
      deriveKey("secrets", SECRET).equals(deriveKey("secrets", SECRET))
    ).toBe(true)
    expect(deriveKey("secrets", SECRET)).toHaveLength(32)
  })

  it("differs across purposes and secrets", () => {
    const keys = (["secrets", "preview", "lead-ip", "cron"] as const).map((p) =>
      deriveKey(p, SECRET).toString("hex")
    )
    expect(new Set(keys).size).toBe(4)
    expect(
      deriveKey("secrets", OTHER).equals(deriveKey("secrets", SECRET))
    ).toBe(false)
  })

  it("defaults to BETTER_AUTH_SECRET from the env", () => {
    process.env.DATABASE_URL = "postgres://sp:sp@127.0.0.1:5432/sp_test"
    process.env.BETTER_AUTH_SECRET = SECRET
    process.env.BETTER_AUTH_URL = "http://localhost:3000"
    try {
      expect(deriveKey("preview").equals(deriveKey("preview", SECRET))).toBe(
        true
      )
    } finally {
      delete process.env.DATABASE_URL
      delete process.env.BETTER_AUTH_SECRET
      delete process.env.BETTER_AUTH_URL
    }
  })
})

describe("encryptSecret / decryptSecret", () => {
  it("round-trips, including unicode", () => {
    for (const plain of ["smtp-pass", "", "pässwörd ☂ – Dinn Rí"]) {
      expect(
        decryptSecret(encryptSecret(plain, AAD, SECRET), AAD, SECRET)
      ).toBe(plain)
    }
  })

  it('formats as "v1:<iv>:<ciphertext>:<tag>" with base64url parts and a fresh IV', () => {
    const a = encryptSecret("value", AAD, SECRET)
    const b = encryptSecret("value", AAD, SECRET)
    const parts = a.split(":")
    expect(parts).toHaveLength(4)
    expect(parts[0]).toBe("v1")
    for (const part of parts.slice(1)) expect(part).toMatch(/^[A-Za-z0-9_-]*$/)
    expect(Buffer.from(parts[1], "base64url")).toHaveLength(12)
    expect(Buffer.from(parts[3], "base64url")).toHaveLength(16)
    expect(a).not.toBe(b)
  })

  it("throws with a different AAD", () => {
    const token = encryptSecret("value", AAD, SECRET)
    expect(() =>
      decryptSecret(token, "integrations.r2.secretAccessKey", SECRET)
    ).toThrow()
  })

  it("throws with a different secret", () => {
    const token = encryptSecret("value", AAD, SECRET)
    expect(() => decryptSecret(token, AAD, OTHER)).toThrow()
  })

  it("throws when the ciphertext or tag is tampered with", () => {
    const [v, iv, ct, tag] = encryptSecret(
      "value-to-protect",
      AAD,
      SECRET
    ).split(":")
    const flip = (b64: string) => {
      const buf = Buffer.from(b64, "base64url")
      buf[0] ^= 0xff
      return buf.toString("base64url")
    }
    expect(() =>
      decryptSecret([v, iv, flip(ct), tag].join(":"), AAD, SECRET)
    ).toThrow()
    expect(() =>
      decryptSecret([v, iv, ct, flip(tag)].join(":"), AAD, SECRET)
    ).toThrow()
  })

  it("throws on malformed tokens", () => {
    expect(() => decryptSecret("plaintext", AAD, SECRET)).toThrow(
      "Malformed encrypted secret"
    )
    expect(() => decryptSecret("v2:a:b:c", AAD, SECRET)).toThrow(
      "Malformed encrypted secret"
    )
    expect(() => decryptSecret("v1:a:b", AAD, SECRET)).toThrow(
      "Malformed encrypted secret"
    )
  })
})

describe("secretHint", () => {
  it('returns "••••" + the last 4 characters', () => {
    expect(secretHint("sk-live-abcd1234")).toBe("••••1234")
  })

  it("reveals nothing for secrets of 4 characters or fewer", () => {
    expect(secretHint("abcd")).toBe("••••")
    expect(secretHint("")).toBe("••••")
  })
})
```

`tests/unit/errors.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  AppError,
  conflict,
  ERROR_CODES,
  fieldErrorsFromIssues,
  forbidden,
  notFound,
} from "@/server/lib/errors"

describe("AppError", () => {
  it.each([
    ["VALIDATION_FAILED", 422],
    ["UNAUTHENTICATED", 401],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["CONFLICT", 409],
    ["RATE_LIMITED", 429],
    ["INTERNAL", 500],
  ] as const)("%s → %i", (code, status) => {
    expect(new AppError(code, "x").status).toBe(status)
  })

  it("covers every error code", () => {
    expect(ERROR_CODES).toEqual([
      "VALIDATION_FAILED",
      "UNAUTHENTICATED",
      "FORBIDDEN",
      "NOT_FOUND",
      "CONFLICT",
      "RATE_LIMITED",
      "INTERNAL",
    ])
  })

  it("is an Error with code, message and details", () => {
    const err = new AppError("VALIDATION_FAILED", "Invalid input", {
      fieldErrors: { slug: ["Required"] },
    })
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("AppError")
    expect(err.message).toBe("Invalid input")
    expect(err.details?.fieldErrors).toEqual({ slug: ["Required"] })
  })
})

describe("helpers", () => {
  it("notFound", () => {
    const err = notFound("Service")
    expect([err.code, err.status, err.message]).toEqual([
      "NOT_FOUND",
      404,
      "Service not found",
    ])
  })

  it("forbidden", () => {
    expect(forbidden().status).toBe(403)
    expect(forbidden().code).toBe("FORBIDDEN")
  })

  it("conflict carries the current state", () => {
    const err = conflict({ version: 4 })
    expect(err.status).toBe(409)
    expect(err.details?.current).toEqual({ version: 4 })
  })

  it("fieldErrorsFromIssues joins nested paths with dots", () => {
    expect(
      fieldErrorsFromIssues([
        { path: ["hero", "heading"], message: "Required" },
        { path: ["items", 2, "label"], message: "Too long" },
        { path: ["items", 2, "label"], message: "Invalid" },
        { path: [], message: "Bad body" },
      ])
    ).toEqual({
      "hero.heading": ["Required"],
      "items.2.label": ["Too long", "Invalid"],
      _root: ["Bad body"],
    })
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test:unit tests/unit/crypto.test.ts tests/unit/errors.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/lib/crypto"` and `"@/server/lib/errors"`.

- [ ] **Step 3: Implement**

`lib/auth/roles.ts`:

```ts
export const ROLES = [
  "owner",
  "admin",
  "editor",
  "author",
  "marketer",
  "intake",
  "viewer",
] as const
export type Role = (typeof ROLES)[number]
```

`server/lib/actor.ts`:

```ts
import "server-only"

import type { Role } from "@/lib/auth/roles"

/** Who is performing a service call. Built from the session in Phase 2 (server/auth/session.ts). */
export type Actor = {
  userId: string
  roles: Role[]
  ip: string | null
  userAgent: string | null
  impersonatorId: string | null
}
```

`server/lib/errors.ts`:

```ts
import "server-only"

export const ERROR_CODES = [
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL",
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

export const STATUS_BY_CODE = {
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
} as const satisfies Record<ErrorCode, number>

export type ErrorDetails = {
  fieldErrors?: Record<string, string[]>
  current?: unknown
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly details?: ErrorDetails

  constructor(code: ErrorCode, message: string, details?: ErrorDetails) {
    super(message)
    this.name = "AppError"
    this.code = code
    this.details = details
  }

  get status(): (typeof STATUS_BY_CODE)[ErrorCode] {
    return STATUS_BY_CODE[this.code]
  }
}

export const notFound = (what: string) =>
  new AppError("NOT_FOUND", `${what} not found`)
export const forbidden = () =>
  new AppError("FORBIDDEN", "You do not have permission to do this")
export const conflict = (current: unknown) =>
  new AppError(
    "CONFLICT",
    "This record was changed by someone else. Reload to see the latest version.",
    { current }
  )

type IssueLike = { path: ReadonlyArray<PropertyKey>; message: string }

/** Zod issues → `{ "hero.heading": ["Required"] }`. Root-level issues use the key "_root". */
export function fieldErrorsFromIssues(
  issues: ReadonlyArray<IssueLike>
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const issue of issues) {
    const key = issue.path.length ? issue.path.map(String).join(".") : "_root"
    ;(out[key] ??= []).push(issue.message)
  }
  return out
}
```

`server/lib/crypto.ts`:

```ts
import "server-only"

import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto"

import { getEnv } from "@/server/env"

export type KeyPurpose = "secrets" | "preview" | "lead-ip" | "cron"

const SALT = "sp/v1"
const VERSION = "v1"
const IV_BYTES = 12
const TAG_BYTES = 16

const rootSecret = (secret?: string) => secret ?? getEnv().BETTER_AUTH_SECRET

/** HKDF-SHA256(ikm = BETTER_AUTH_SECRET, salt = "sp/v1", info = purpose) → 32 bytes. */
export function deriveKey(purpose: KeyPurpose, secret?: string): Buffer {
  return Buffer.from(hkdfSync("sha256", rootSecret(secret), SALT, purpose, 32))
}

/** AES-256-GCM with a random 12-byte IV. Returns "v1:<iv>:<ciphertext>:<tag>" (base64url parts). */
export function encryptSecret(
  plain: string,
  aad: string,
  secret?: string
): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv("aes-256-gcm", deriveKey("secrets", secret), iv)
  cipher.setAAD(Buffer.from(aad, "utf8"))
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [
    VERSION,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(":")
}

/** Throws if the token is malformed, was encrypted with another secret, another AAD, or was tampered with. */
export function decryptSecret(
  token: string,
  aad: string,
  secret?: string
): string {
  const parts = token.split(":")
  if (parts.length !== 4 || parts[0] !== VERSION)
    throw new Error("Malformed encrypted secret")
  const iv = Buffer.from(parts[1], "base64url")
  const ciphertext = Buffer.from(parts[2], "base64url")
  const tag = Buffer.from(parts[3], "base64url")
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES)
    throw new Error("Malformed encrypted secret")
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveKey("secrets", secret),
      iv
    )
    decipher.setAAD(Buffer.from(aad, "utf8"))
    decipher.setAuthTag(tag)
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8")
  } catch {
    throw new Error(
      "Unable to decrypt secret (wrong key, wrong context or tampered data)"
    )
  }
}

/** "••••" + last 4 characters. Secrets of 4 characters or fewer reveal nothing. */
export function secretHint(plain: string): string {
  return plain.length <= 4 ? "••••" : `••••${plain.slice(-4)}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:unit`
Expected: PASS — `crypto.test.ts` (11), `errors.test.ts` (13), plus earlier files; the server-only guard now also lists `server/lib/actor.ts`, `server/lib/errors.ts`, `server/lib/crypto.ts`.

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/roles.ts server/lib/actor.ts server/lib/errors.ts server/lib/crypto.ts tests/unit/crypto.test.ts tests/unit/errors.test.ts
git commit -m "feat: add crypto, error and actor primitives

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Database client, schema foundation, migrations, dev compose (master Task 1.4)

**Files:**
- Create: `docker-compose.dev.yml`
- Create: `docker/postgres-init.sql`
- Create: `.env.example`
- Modify: `.gitignore` (append `!.env.example`)
- Create: `drizzle.config.ts`
- Create: `server/db/schema/_shared.ts`
- Create: `server/db/schema/index.ts`
- Create: `server/db/client.ts`
- Create: `server/db/migrate.ts`
- Create: `scripts/migrate.ts`
- Create: `scripts/register-server-only.mjs`
- Create (generated): `server/db/migrations/0000_init.sql`, `server/db/migrations/meta/_journal.json`, `server/db/migrations/meta/0000_snapshot.json`
- Modify: `vitest.config.ts` (add `integration` project)
- Modify: `package.json` (scripts `db:up`, `db:down`, `db:generate`, `db:migrate`, `tsx:server`)
- Modify: `README.md` (append "Local development")
- Create: `tests/integration/db.ts`, `tests/integration/global-setup.ts`, `tests/integration/setup.ts`
- Test: `tests/integration/db/client.test.ts`
- Test: `tests/unit/db-client.test.ts`

**Interfaces:**
- Consumes: `AppError` (Task 3), `getEnv()` (Task 2).
- Produces:

```ts
// server/db/schema/_shared.ts
export const CONTENT_STATUSES = ["draft", "in_review", "scheduled", "published"] as const
export const contentStatus  // pgEnum("content_status", CONTENT_STATUSES)
export const id: () => uuid("id").primaryKey().$defaultFn(uuidv7)   // every table's id column
export const tsz: (name: string) => timestamp(name, { withTimezone: true, mode: "date" })
export const timestamps: () => ({ createdAt, updatedAt })            // created_at / updated_at timestamptz, updatedAt $onUpdate
// server/db/schema/index.ts — the schema object; later phases append `export * from "./<module>"`
// server/db/client.ts
export type Db = NodePgDatabase<typeof schema>
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0]
export function getDb(): Db                      // lazy Pool (max 10); AppError("INTERNAL", "DATABASE_URL is not set") if unset
export async function closeDb(): Promise<void>
export async function pingDb(timeoutMs = 3000): Promise<boolean>   // never throws
// server/db/migrate.ts
export const MIGRATIONS_DIR: string               // <cwd>/server/db/migrations
export async function runMigrations(url: string, migrationsFolder = MIGRATIONS_DIR): Promise<void> // advisory-locked
// tests/integration/db.ts (tests only)
export const TEST_DATABASE_URL: string            // TEST_DATABASE_URL ?? postgres://sp:sp@127.0.0.1:5432/sp_test
export async function resetDb(): Promise<void>     // truncates every table in schema public
```

- Scripts: `pnpm db:up` (Postgres 17 + Mailpit, waits until healthy), `pnpm db:down`, `pnpm db:generate [--name x]`, `pnpm db:migrate`, `pnpm tsx:server <file.ts> [args]` (runs a TS script with `.env.development` + the `server-only` hook; later phases' `db:seed`, `admin:create`, … use it).
- Dev URLs: `postgres://sp:sp@127.0.0.1:5432/sp_dev` | `sp_test` | `sp_e2e`; Mailpit SMTP `localhost:1025`, UI `http://localhost:8025`.

- [ ] **Step 1: Add the integration project and test helpers**

`vitest.config.ts` (full file, replaces Task 1's):

```ts
import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

const serverOnlyStub = fileURLToPath(
  new URL("./tests/stubs/server-only.ts", import.meta.url)
)

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // `server-only` throws outside Next's react-server bundles.
    alias: { "server-only": serverOnlyStub },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
          setupFiles: ["./tests/unit/setup.ts"],
        },
      },
      {
        // Real Postgres (sp_test). Needs `pnpm db:up` locally; CI provides a
        // postgres service. Files run one at a time: they share one database.
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["./tests/integration/global-setup.ts"],
          setupFiles: ["./tests/integration/setup.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
})
```

`tests/integration/db.ts`:

```ts
import { sql } from "drizzle-orm"

import { getDb } from "@/server/db/client"

/** sp_test from docker-compose.dev.yml; CI's postgres service uses the same URL. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://sp:sp@127.0.0.1:5432/sp_test"

/** Truncates every table in the public schema (migration bookkeeping lives in the "drizzle" schema). */
export async function resetDb(): Promise<void> {
  const db = getDb()
  const { rows } = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`
  )
  if (rows.length === 0) return
  const list = rows
    .map((r) => `"public"."${r.tablename.replaceAll('"', '""')}"`)
    .join(", ")
  await db.execute(sql.raw(`truncate table ${list} restart identity cascade`))
}
```

`tests/integration/global-setup.ts`:

```ts
import { Client } from "pg"

import { runMigrations } from "@/server/db/migrate"

import { TEST_DATABASE_URL } from "./db"

const redact = (url: string) => url.replace(/\/\/([^:/@]+):[^@]*@/, "//$1:***@")

/** Runs once per `vitest` invocation: fails loudly if Postgres is down, then migrates sp_test. */
export default async function globalSetup() {
  const client = new Client({
    connectionString: TEST_DATABASE_URL,
    connectionTimeoutMillis: 5_000,
  })
  try {
    await client.connect()
    await client.query("select 1")
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Integration tests need Postgres at ${redact(TEST_DATABASE_URL)} (${cause}).\n` +
        "Start it with `pnpm db:up` (CI provides a postgres service). Unit tests only: `pnpm test:unit`."
    )
  } finally {
    await client.end().catch(() => undefined)
  }
  await runMigrations(TEST_DATABASE_URL)
}
```

`tests/integration/setup.ts`:

```ts
import { afterAll } from "vitest"

import { closeDb } from "@/server/db/client"

import { TEST_DATABASE_URL } from "./db"

// Integration tests always run against sp_test with fixed, test-only secrets.
process.env.DATABASE_URL = TEST_DATABASE_URL
process.env.BETTER_AUTH_SECRET = "test-secret-0123456789abcdef0123456789abcdef"
process.env.BETTER_AUTH_URL = "http://localhost:3000"

afterAll(async () => {
  await closeDb()
})
```

- [ ] **Step 2: Write the failing tests**

`tests/unit/db-client.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { getDb, pingDb } from "@/server/db/client"
import { AppError } from "@/server/lib/errors"

describe("getDb", () => {
  it("throws AppError INTERNAL when DATABASE_URL is missing (lazy: importing did not throw)", () => {
    delete process.env.DATABASE_URL
    let caught: unknown
    try {
      getDb()
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(AppError)
    expect((caught as AppError).code).toBe("INTERNAL")
    expect((caught as AppError).message).toBe("DATABASE_URL is not set")
  })

  it("pingDb returns false instead of throwing when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL
    await expect(pingDb()).resolves.toBe(false)
  })
})
```

`tests/integration/db/client.test.ts`:

```ts
import { sql } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { getDb, pingDb } from "@/server/db/client"

import { resetDb } from "../db"

describe("database client (sp_test)", () => {
  it("connects and runs select 1", async () => {
    const { rows } = await getDb().execute<{ one: number }>(
      sql`select 1 as one`
    )
    expect(rows).toEqual([{ one: 1 }])
    await expect(pingDb()).resolves.toBe(true)
  })

  it("has the migrations applied (content_status enum, journal row)", async () => {
    const db = getDb()
    const { rows: labels } = await db.execute<{ label: string }>(
      sql`select e.enumlabel as label from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'content_status' order by e.enumsortorder`
    )
    expect(labels.map((r) => r.label)).toEqual([
      "draft",
      "in_review",
      "scheduled",
      "published",
    ])
    const { rows: applied } = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from drizzle.__drizzle_migrations`
    )
    expect(applied[0].n).toBeGreaterThanOrEqual(1)
  })

  it("resetDb truncates every public table", async () => {
    const db = getDb()
    await db.execute(
      sql`create table if not exists public.reset_probe (id int)`
    )
    await db.execute(sql`insert into public.reset_probe values (1), (2)`)
    await resetDb()
    const { rows } = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from public.reset_probe`
    )
    expect(rows[0].n).toBe(0)
    await db.execute(sql`drop table public.reset_probe`)
  })
})
```

- [ ] **Step 3: Run the unit test to verify it fails**

Run: `pnpm test:unit tests/unit/db-client.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/db/client"`.

- [ ] **Step 4: Dev compose, init SQL, env example**

`docker-compose.dev.yml`:

```yaml
# Local development services (never deployed).
#   pnpm db:up    start Postgres 17 + Mailpit and wait until healthy
#   pnpm db:down  stop them (data stays in the pgdata volume)
# Databases: sp_dev (next dev, scripts), sp_test (Vitest integration),
# sp_e2e (Playwright E2E). Mailpit: SMTP localhost:1025, UI http://localhost:8025.
name: security-partners-dev

services:
  postgres:
    image: postgres:17
    restart: unless-stopped
    environment:
      POSTGRES_USER: sp
      POSTGRES_PASSWORD: sp
      POSTGRES_DB: sp_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/postgres-init.sql:/docker-entrypoint-initdb.d/10-databases.sql:ro
    healthcheck:
      # TCP check: only passes after the init scripts ran and the server restarted.
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U sp -d sp_dev"]
      interval: 2s
      timeout: 3s
      retries: 30

  mailpit:
    image: axllent/mailpit:v1.31.4
    restart: unless-stopped
    ports:
      - "1025:1025"
      - "8025:8025"

volumes:
  pgdata:
```

`docker/postgres-init.sql`:

```sql
-- Runs once, when the dev Postgres volume is first created.
-- sp_dev comes from POSTGRES_DB; these are the test and E2E databases.
CREATE DATABASE sp_test;
CREATE DATABASE sp_e2e;
```

`.env.example`:

```bash
# Local development only. Copy to .env.development (gitignored):
#   cp .env.example .env.development
# `next dev` and `pnpm tsx:server …` scripts read .env.development;
# `next build` / `next start` never do, so builds stay env-free.
# Production sets exactly these three variables in Dokploy (docker-compose.yml).
# Everything else (SMTP, R2, Turnstile, AI, tracking) is configured in the admin.
DATABASE_URL=postgres://sp:sp@127.0.0.1:5432/sp_dev
BETTER_AUTH_SECRET=dev-only-secret-change-me-0123456789abcdef
BETTER_AUTH_URL=http://localhost:3000
```

Append the negation after the existing `.env*` rule:

```bash
grep -qxF '!.env.example' .gitignore || printf '!.env.example\n' >> .gitignore
cp .env.example .env.development
git check-ignore -q .env.development && echo "ignored ok"
git check-ignore -q .env.example || echo "example tracked ok"
```

Expected: `ignored ok` and `example tracked ok`.

- [ ] **Step 5: `server-only` hook for Node-run tools + package scripts**

`scripts/register-server-only.mjs`:

```js
// Lets Node-run tools (tsx scripts, drizzle-kit) load server/** modules.
// `server-only` throws unless it is resolved with the "react-server"
// condition, which only Next's server bundles use. Outside Next we point
// this one specifier at the package's own empty.js; every other package
// keeps normal resolution (react-dom/server must never see "react-server").
// Vitest uses resolve.alias and the esbuild script bundle a plugin instead.
import { createRequire, registerHooks } from "node:module"
import { dirname, join } from "node:path"
import { pathToFileURL } from "node:url"

const require = createRequire(import.meta.url)
const EMPTY_URL = pathToFileURL(
  join(dirname(require.resolve("server-only")), "empty.js")
).href

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only")
      return { url: EMPTY_URL, shortCircuit: true }
    return nextResolve(specifier, context)
  },
})
```

(`module.registerHooks` needs Node ≥ 22.15; local is 22.19, the image's `node:22-alpine` is 22.23. It covers both `import` and `require`, which drizzle-kit needs.)

```bash
pnpm pkg set scripts.tsx:server="tsx --env-file-if-exists=.env.development --import ./scripts/register-server-only.mjs"
pnpm pkg set scripts.db:up="docker compose -f docker-compose.dev.yml up -d --wait"
pnpm pkg set scripts.db:down="docker compose -f docker-compose.dev.yml down"
pnpm pkg set scripts.db:generate="NODE_OPTIONS='--import ./scripts/register-server-only.mjs' drizzle-kit generate"
pnpm pkg set scripts.db:migrate="pnpm tsx:server scripts/migrate.ts"
```

`--env-file-if-exists` never overrides variables already set in the environment (CI/production values win).

- [ ] **Step 6: Schema foundation, client, migrator, migrate script, drizzle config**

`server/db/schema/_shared.ts`:

```ts
import "server-only"

import { pgEnum, timestamp, uuid } from "drizzle-orm/pg-core"
import { uuidv7 } from "uuidv7"

export const CONTENT_STATUSES = [
  "draft",
  "in_review",
  "scheduled",
  "published",
] as const
export const contentStatus = pgEnum("content_status", CONTENT_STATUSES)
export const id = () =>
  uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7())
export const tsz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" })
export const timestamps = () => ({
  createdAt: tsz("created_at").notNull().defaultNow(),
  updatedAt: tsz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})
```

`server/db/schema/index.ts`:

```ts
import "server-only"

// Every table/enum module is re-exported here; drizzle.config.ts and
// getDb() both read this file. Later phases append `export * from "./<module>"`.
export { contentStatus } from "./_shared"
```

`server/db/client.ts`:

```ts
import "server-only"

import { sql } from "drizzle-orm"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { AppError } from "@/server/lib/errors"

import * as schema from "./schema"

export type Db = NodePgDatabase<typeof schema>
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0]

type Holder = { url: string; pool: Pool; db: Db }

// Kept on globalThis so `next dev` HMR does not open a new pool per reload.
const store = globalThis as unknown as { __spDb?: Holder }

/**
 * Lazy pg Pool + Drizzle. Nothing connects at import time, so `next build`
 * works without DATABASE_URL. A changed DATABASE_URL (tests) gets a new pool.
 */
export function getDb(): Db {
  const url = process.env.DATABASE_URL
  if (!url) throw new AppError("INTERNAL", "DATABASE_URL is not set")
  const current = store.__spDb
  if (current?.url === url) return current.db
  if (current) void current.pool.end().catch(() => undefined)
  const pool = new Pool({
    connectionString: url,
    max: 10,
    connectionTimeoutMillis: 5_000,
  })
  pool.on("error", (err) =>
    console.error("[db] idle client error", err.message)
  )
  const db = drizzle({ client: pool, schema })
  store.__spDb = { url, pool, db }
  return db
}

/** Ends the pool (scripts and tests). */
export async function closeDb(): Promise<void> {
  const current = store.__spDb
  store.__spDb = undefined
  if (current) await current.pool.end()
}

/** `select 1` with a timeout. Never throws: false means unreachable or misconfigured. */
export async function pingDb(timeoutMs = 3_000): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined
  try {
    const db = getDb()
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("db ping timed out")),
        timeoutMs
      )
    })
    await Promise.race([db.execute(sql`select 1`), timeout])
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
```

`server/db/migrate.ts`:

```ts
import "server-only"

import { resolve } from "node:path"

import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Client } from "pg"

// Any constant works; it only has to be the same for every app instance.
const MIGRATION_LOCK_ID = 7_314_001

/** Default: <cwd>/server/db/migrations (repo root in dev/CI, /app in the container). */
export const MIGRATIONS_DIR = resolve(process.cwd(), "server/db/migrations")

/**
 * Applies pending Drizzle migrations. A Postgres advisory lock serialises
 * concurrent runs (several replicas starting at once).
 */
export async function runMigrations(
  url: string,
  migrationsFolder = MIGRATIONS_DIR
): Promise<void> {
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 10_000,
  })
  await client.connect()
  try {
    await client.query("select pg_advisory_lock($1)", [MIGRATION_LOCK_ID])
    try {
      await migrate(drizzle({ client }), { migrationsFolder })
    } finally {
      await client.query("select pg_advisory_unlock($1)", [MIGRATION_LOCK_ID])
    }
  } finally {
    await client.end()
  }
}
```

`scripts/migrate.ts`:

```ts
// Applies pending migrations.
//   dev:       pnpm db:migrate              (env from .env.development)
//   container: node scripts/dist/migrate.mjs (docker-entrypoint.sh, before server.js)
// Validates all three env vars first, so a misconfigured container fails at
// start with a readable list instead of on the first request.
import { runMigrations } from "@/server/db/migrate"
import { getEnv } from "@/server/env"

try {
  const { DATABASE_URL } = getEnv()
  await runMigrations(DATABASE_URL)
  console.log("[migrate] migrations applied")
} catch (err) {
  console.error(`[migrate] ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
}
```

`drizzle.config.ts`:

```ts
import { existsSync } from "node:fs"

import { defineConfig } from "drizzle-kit"

if (!process.env.DATABASE_URL && existsSync(".env.development"))
  process.loadEnvFile(".env.development")

export default defineConfig({
  dialect: "postgresql",
  schema: "./server/db/schema/index.ts",
  out: "./server/db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
})
```

- [ ] **Step 7: Generate the initial migration**

Run: `pnpm db:generate --name init`
Expected: `[✓] Your SQL migration file ➜ server/db/migrations/0000_init.sql`, and the file contains exactly:

```sql
CREATE TYPE "public"."content_status" AS ENUM('draft', 'in_review', 'scheduled', 'published');
```

plus `server/db/migrations/meta/_journal.json` (one entry, tag `0000_init`) and `meta/0000_snapshot.json`. If it fails with `This module cannot be imported from a Client Component module`, the `NODE_OPTIONS` hook is missing from the script.

- [ ] **Step 8: Start Postgres and migrate sp_dev**

Run: `pnpm db:up`
Expected: `Container security-partners-dev-postgres-1 Healthy` and `…-mailpit-1 Healthy` (port 5432 must be free).

Run: `pnpm db:migrate`
Expected: `[migrate] migrations applied`. Running it a second time prints the same line (idempotent).

Verify: `docker compose -f docker-compose.dev.yml exec -T postgres psql -U sp -d sp_dev -Atc "select datname from pg_database where datname like 'sp_%' order by 1"`
Expected: `sp_dev`, `sp_e2e`, `sp_test`.

- [ ] **Step 9: Run all tests**

Run: `pnpm test`
Expected: PASS — unit project (incl. `db-client.test.ts` 2 tests, guard now also covers `server/db/**`) and integration project (`db/client.test.ts` 3 tests).

Prove the loud failure: `TEST_DATABASE_URL=postgres://sp:sp@127.0.0.1:1/sp_test pnpm test:integration`
Expected: FAIL (non-zero exit) with `Integration tests need Postgres at postgres://sp:***@127.0.0.1:1/sp_test (connect ECONNREFUSED 127.0.0.1:1).` and the `pnpm db:up` hint.

- [ ] **Step 10: Build with no env**

Run: `env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: build succeeds (`.env.development` is not read by `next build`; nothing in `server/` touches env or the DB at import).

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 11: README — local development**

Append to `README.md`:

````markdown
## Local development

```bash
pnpm install
cp .env.example .env.development   # dev-only values; `next build` never reads them
pnpm db:up                          # Postgres 17 (sp_dev, sp_test, sp_e2e) + Mailpit (http://localhost:8025)
pnpm db:migrate
pnpm dev
```

- `pnpm test:unit` — unit tests, no services needed.
- `pnpm test:integration` — needs `pnpm db:up`; uses the `sp_test` database and migrates it automatically. It fails loudly when Postgres is not reachable (CI provides a postgres service). Override the URL with `TEST_DATABASE_URL`.
- `pnpm test` — both projects.
- `pnpm db:generate --name <change>` after editing `server/db/schema/*`, then `pnpm db:migrate`.
- Scripts that import `server/**` run with `pnpm tsx:server <file.ts>` (loads `.env.development` and stubs `server-only` outside Next).
- `pnpm db:down` stops the services (data is kept in a Docker volume).
````

- [ ] **Step 12: Commit**

```bash
git add docker-compose.dev.yml docker/postgres-init.sql .env.example .gitignore drizzle.config.ts server/db scripts/migrate.ts scripts/register-server-only.mjs vitest.config.ts package.json README.md tests/integration tests/unit/db-client.test.ts
git commit -m "feat: add postgres dev stack, drizzle client and migrations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Hono skeleton, error envelope, health (master Task 1.5)

**Files:**
- Create: `app/api/[...route]/route.ts`
- Create: `server/api/app.ts`
- Create: `server/api/context.ts`
- Create: `server/api/validate.ts`
- Create: `server/api/middleware/error.ts`
- Create: `server/api/middleware/request-id.ts`
- Create: `server/api/middleware/same-origin.ts`
- Create: `server/api/middleware/body-limit.ts`
- Create: `server/modules/health/routes.ts`
- Test: `tests/unit/api/error-envelope.test.ts`
- Test: `tests/integration/api/health.test.ts`

**Interfaces:**
- Consumes: `AppError`, `fieldErrorsFromIssues` (Task 3), `Actor` (Task 3), `getEnv()` (Task 2), `pingDb()` (Task 4).
- Produces:

```ts
// server/api/context.ts
export type AppEnv = { Variables: RequestIdVariables & { actor: Actor | null } }  // requestId: string
// server/api/app.ts
export const adminRoutes: Hono<AppEnv>           // mounted at /api/v1/admin; later phases chain .route(...)
export type AdminApi = typeof adminRoutes
export function createApp(): Hono<AppEnv, …, "/api">  // fresh instance (tests add routes to their own)
export const app: ReturnType<typeof createApp>   // basePath("/api")
// server/api/validate.ts
export const zv: (target, schema) => MiddlewareHandler // throws AppError("VALIDATION_FAILED", "Invalid input", { fieldErrors })
// server/api/middleware/error.ts
export type ErrorEnvelope = { error: { code: ErrorCode; message: string; fieldErrors?: Record<string, string[]>; current?: unknown; requestId: string } }
export function errorEnvelope(c, code, message, extra?): ErrorEnvelope
export const onError: ErrorHandler<AppEnv>        // AppError → its status; HTTPException → mapped code; else 500 INTERNAL (logged, no details)
export const notFoundHandler: NotFoundHandler<AppEnv> // 404 NOT_FOUND "Route not found"
// server/api/middleware/request-id.ts
export const requestIdMiddleware                  // reuses incoming X-Request-Id, else uuid v7; sets X-Request-Id
// server/api/middleware/same-origin.ts
export const sameOrigin: (allowedOrigins?: () => string[]) => MiddlewareHandler<AppEnv> // default [origin of BETTER_AUTH_URL]
// server/api/middleware/body-limit.ts
export const BODY_LIMITS = { public: 65536, admin: 1048576, upload: 20971520 }
export const limitBody: (kind: "public" | "admin" | "upload") => MiddlewareHandler // 413 envelope, code VALIDATION_FAILED
// server/modules/health/routes.ts
export const healthRoutes  // GET /live → 200 {status:"ok"}; GET / → 200 {status:"ok",db:"ok"} | 503 {status:"unavailable"}; Cache-Control: no-store
```

- Mount order in `createApp()` (spec §7): global `requestId` → `secureHeaders()` → `actor=null` + `X-Robots-Tag: noindex` → `onError`/`notFound`; `/v1/public/*` → 64 KB limit; `/v1/admin/*` → `sameOrigin()` → 1 MB limit → `adminRoutes`; `/v1/health` → `healthRoutes`. Phase 2 adds `/api/auth/*` (Better Auth) and inserts session + signed-in middleware before `sameOrigin()`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/api/error-envelope.test.ts`:

```ts
import { HTTPException } from "hono/http-exception"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { createApp } from "@/server/api/app"
import { zv } from "@/server/api/validate"
import { AppError, conflict } from "@/server/lib/errors"

const app = createApp()
// Test-only routes on a private app instance.
app.get("/v1/__test/app-error", () => {
  throw new AppError("FORBIDDEN", "Nope")
})
app.get("/v1/__test/conflict", () => {
  throw conflict({ version: 3 })
})
app.get("/v1/__test/http-exception", () => {
  throw new HTTPException(401, { message: "Sign in" })
})
app.get("/v1/__test/boom", () => {
  throw new Error("secret detail /var/app/server.ts:42")
})
app.post(
  "/v1/__test/validate",
  zv(
    "json",
    z.object({
      slug: z.string().min(1),
      hero: z.object({ heading: z.string() }),
    })
  ),
  (c) => c.json({ ok: true })
)
app.post("/v1/public/__test/echo", async (c) =>
  c.json({ size: (await c.req.text()).length })
)
app.post("/v1/admin/__test/echo", async (c) =>
  c.json({ size: (await c.req.text()).length })
)

const ORIGIN = "http://localhost:3000"

beforeAll(() => {
  process.env.DATABASE_URL = "postgres://sp:sp@127.0.0.1:5432/sp_test"
  process.env.BETTER_AUTH_SECRET =
    "test-secret-0123456789abcdef0123456789abcdef"
  process.env.BETTER_AUTH_URL = ORIGIN
})
afterAll(() => {
  delete process.env.DATABASE_URL
  delete process.env.BETTER_AUTH_SECRET
  delete process.env.BETTER_AUTH_URL
})

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe("API error envelope", () => {
  it("GET /api/v1/health/live → 200 {status:ok} without touching the DB", async () => {
    const res = await app.request("/api/v1/health/live")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: "ok" })
    expect(res.headers.get("cache-control")).toBe("no-store")
  })

  it("unknown route → 404 envelope with requestId (uuid v7, echoed in X-Request-Id)", async () => {
    const res = await app.request("/api/v1/nope")
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        requestId: expect.stringMatching(UUID),
      },
    })
    expect(res.headers.get("x-request-id")).toBe(body.error.requestId)
  })

  it("reuses an incoming X-Request-Id", async () => {
    const res = await app.request("/api/v1/nope", {
      headers: { "X-Request-Id": "req-123" },
    })
    expect((await res.json()).error.requestId).toBe("req-123")
  })

  it("thrown AppError → its status and code", async () => {
    const res = await app.request("/api/v1/__test/app-error")
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Nope",
        requestId: expect.any(String),
      },
    })
  })

  it("conflict → 409 with current state", async () => {
    const res = await app.request("/api/v1/__test/conflict")
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe("CONFLICT")
    expect(body.error.current).toEqual({ version: 3 })
  })

  it("HTTPException → mapped code", async () => {
    const res = await app.request("/api/v1/__test/http-exception")
    expect(res.status).toBe(401)
    expect((await res.json()).error).toMatchObject({
      code: "UNAUTHENTICATED",
      message: "Sign in",
    })
  })

  it("unknown error → 500 INTERNAL without message or stack in the body", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const res = await app.request("/api/v1/__test/boom")
    expect(res.status).toBe(500)
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({
      error: {
        code: "INTERNAL",
        message: "Internal server error",
        requestId: expect.any(String),
      },
    })
    expect(text).not.toContain("secret detail")
    expect(text).not.toContain("server.ts")
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it("zv → 422 VALIDATION_FAILED with dotted fieldErrors", async () => {
    const res = await app.request("/api/v1/__test/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "", hero: {} }),
    })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe("VALIDATION_FAILED")
    expect(Object.keys(body.error.fieldErrors).sort()).toEqual([
      "hero.heading",
      "slug",
    ])
  })

  it("sets secureHeaders and X-Robots-Tag: noindex on success and error responses", async () => {
    for (const path of [
      "/api/v1/health/live",
      "/api/v1/nope",
      "/api/v1/__test/boom",
    ]) {
      const spy = vi.spyOn(console, "error").mockImplementation(() => undefined)
      const res = await app.request(path)
      spy.mockRestore()
      expect(res.headers.get("x-content-type-options")).toBe("nosniff")
      expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN")
      expect(res.headers.get("strict-transport-security")).toContain("max-age=")
      expect(res.headers.get("x-robots-tag")).toBe("noindex")
    }
  })
})

describe("body limits", () => {
  it("public: 64 KB ok, larger → 413 envelope", async () => {
    const ok = await app.request("/api/v1/public/__test/echo", {
      method: "POST",
      body: "a".repeat(64 * 1024),
    })
    expect(ok.status).toBe(200)
    const tooBig = await app.request("/api/v1/public/__test/echo", {
      method: "POST",
      body: "a".repeat(64 * 1024 + 1),
    })
    expect(tooBig.status).toBe(413)
    expect((await tooBig.json()).error.code).toBe("VALIDATION_FAILED")
  })

  it("admin: 1 MB ok, larger → 413 envelope", async () => {
    const headers = { origin: ORIGIN }
    const ok = await app.request("/api/v1/admin/__test/echo", {
      method: "POST",
      headers,
      body: "a".repeat(1024 * 1024),
    })
    expect(ok.status).toBe(200)
    const tooBig = await app.request("/api/v1/admin/__test/echo", {
      method: "POST",
      headers,
      body: "a".repeat(1024 * 1024 + 1),
    })
    expect(tooBig.status).toBe(413)
  })
})

describe("sameOrigin on /api/v1/admin/*", () => {
  const post = (headers: Record<string, string>) =>
    app.request("/api/v1/admin/__test/echo", {
      method: "POST",
      headers,
      body: "x",
    })

  it("allows the app origin", async () => {
    expect((await post({ origin: ORIGIN })).status).toBe(200)
  })

  it("allows Sec-Fetch-Site: same-origin when Origin is absent", async () => {
    expect((await post({ "sec-fetch-site": "same-origin" })).status).toBe(200)
  })

  it("rejects a foreign origin with 403 FORBIDDEN", async () => {
    const res = await post({ origin: "https://evil.example" })
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe("FORBIDDEN")
  })

  it("rejects an unsafe request with neither header", async () => {
    expect((await post({})).status).toBe(403)
  })

  it("lets safe methods through", async () => {
    const res = await app.request("/api/v1/admin/__test/missing", {
      headers: { origin: "https://evil.example" },
    })
    expect(res.status).toBe(404)
  })
})
```

`tests/integration/api/health.test.ts` (Review Focus 4: readiness → 503, no stack/driver detail leaks):

```ts
import { afterEach, describe, expect, it } from "vitest"

import { app } from "@/server/api/app"

import { TEST_DATABASE_URL } from "../db"

afterEach(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL
})

describe("health endpoints", () => {
  it("GET /api/v1/health → 200 when Postgres is reachable", async () => {
    const res = await app.request("/api/v1/health")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: "ok", db: "ok" })
  })

  it("GET /api/v1/health → 503 {status:unavailable} when Postgres is unreachable (closed port)", async () => {
    process.env.DATABASE_URL = "postgres://sp:sp@127.0.0.1:1/sp_test"
    const res = await app.request("/api/v1/health")
    expect(res.status).toBe(503)
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({ status: "unavailable" })
    expect(text).not.toContain("ECONNREFUSED")
  })

  it("GET /api/v1/health/live → 200 even when Postgres is unreachable", async () => {
    process.env.DATABASE_URL = "postgres://sp:sp@127.0.0.1:1/sp_test"
    const res = await app.request("/api/v1/health/live")
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test:unit tests/unit/api/error-envelope.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/api/app"`.

Run: `pnpm test:integration tests/integration/api/health.test.ts`
Expected: FAIL — same unresolved import.

- [ ] **Step 3: Implement context, middleware, validator**

`server/api/context.ts`:

```ts
import "server-only"

import type { RequestIdVariables } from "hono/request-id"

import type { Actor } from "@/server/lib/actor"

export type AppEnv = {
  Variables: RequestIdVariables & {
    /** null until Phase 2's session middleware resolves a signed-in user. */
    actor: Actor | null
  }
}
```

`server/api/middleware/request-id.ts`:

```ts
import "server-only"

import { requestId } from "hono/request-id"
import { uuidv7 } from "uuidv7"

/** Reuses a sane incoming X-Request-Id, otherwise a uuid v7. Echoed in the X-Request-Id response header. */
export const requestIdMiddleware = requestId({ generator: () => uuidv7() })
```

`server/api/middleware/error.ts`:

```ts
import "server-only"

import type { Context, ErrorHandler, NotFoundHandler } from "hono"
import { HTTPException } from "hono/http-exception"
import type { ContentfulStatusCode } from "hono/utils/http-status"

import type { AppEnv } from "@/server/api/context"
import { AppError, type ErrorCode } from "@/server/lib/errors"

export type ErrorEnvelope = {
  error: {
    code: ErrorCode
    message: string
    fieldErrors?: Record<string, string[]>
    current?: unknown
    requestId: string
  }
}

export function errorEnvelope(
  c: Context<AppEnv>,
  code: ErrorCode,
  message: string,
  extra: { fieldErrors?: Record<string, string[]>; current?: unknown } = {}
): ErrorEnvelope {
  return { error: { code, message, ...extra, requestId: c.get("requestId") } }
}

const codeForStatus = (status: number): ErrorCode => {
  if (status === 401) return "UNAUTHENTICATED"
  if (status === 403) return "FORBIDDEN"
  if (status === 404) return "NOT_FOUND"
  if (status === 409) return "CONFLICT"
  if (status === 429) return "RATE_LIMITED"
  if (status >= 400 && status < 500) return "VALIDATION_FAILED"
  return "INTERNAL"
}

export const onError: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof AppError) {
    if (err.status >= 500)
      console.error(`[api] ${c.get("requestId")} ${err.code}: ${err.message}`)
    const extra = {
      fieldErrors: err.details?.fieldErrors,
      current: err.details?.current,
    }
    return c.json(errorEnvelope(c, err.code, err.message, extra), err.status)
  }
  if (err instanceof HTTPException) {
    const status = err.status as ContentfulStatusCode
    const code = codeForStatus(status)
    const message =
      status >= 500 ? "Internal server error" : err.message || "Request failed"
    return c.json(errorEnvelope(c, code, message), status)
  }
  // Unknown error: log with the request id, never send the message or stack.
  console.error(`[api] ${c.get("requestId")} unhandled error`, err)
  return c.json(errorEnvelope(c, "INTERNAL", "Internal server error"), 500)
}

export const notFoundHandler: NotFoundHandler<AppEnv> = (c) =>
  c.json(errorEnvelope(c, "NOT_FOUND", "Route not found"), 404)
```

`server/api/middleware/same-origin.ts`:

```ts
import "server-only"

import { createMiddleware } from "hono/factory"

import type { AppEnv } from "@/server/api/context"
import { getEnv } from "@/server/env"
import { AppError } from "@/server/lib/errors"

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

const defaultAllowedOrigins = () => [new URL(getEnv().BETTER_AUTH_URL).origin]

/**
 * CSRF guard for cookie-authenticated admin routes: unsafe methods must carry
 * an Origin equal to the app origin (BETTER_AUTH_URL). Without an Origin header,
 * Sec-Fetch-Site must be "same-origin". Anything else → 403 FORBIDDEN.
 */
export const sameOrigin = (
  allowedOrigins: () => string[] = defaultAllowedOrigins
) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) return next()
    const origin = c.req.header("origin")
    const ok = origin
      ? allowedOrigins().includes(origin)
      : c.req.header("sec-fetch-site") === "same-origin"
    if (!ok) throw new AppError("FORBIDDEN", "Cross-origin request rejected")
    return next()
  })
```

`server/api/middleware/body-limit.ts`:

```ts
import "server-only"

import { bodyLimit } from "hono/body-limit"

import { errorEnvelope } from "./error"

export const BODY_LIMITS = {
  public: 64 * 1024,
  admin: 1024 * 1024,
  upload: 20 * 1024 * 1024,
} as const

export type BodyLimitKind = keyof typeof BODY_LIMITS

/** 413 with the standard envelope (code VALIDATION_FAILED) when the body exceeds the limit. */
export const limitBody = (kind: BodyLimitKind) =>
  bodyLimit({
    maxSize: BODY_LIMITS[kind],
    onError: (c) =>
      c.json(
        errorEnvelope(
          c,
          "VALIDATION_FAILED",
          `Request body exceeds ${BODY_LIMITS[kind] / 1024} KB`
        ),
        413
      ),
  })
```

`server/api/validate.ts`:

```ts
import "server-only"

import { zValidator } from "@hono/zod-validator"
import type { ValidationTargets } from "hono"
import type { z } from "zod"

import { AppError, fieldErrorsFromIssues } from "@/server/lib/errors"

/** zValidator that throws AppError("VALIDATION_FAILED") → 422 envelope with fieldErrors. */
export const zv = <Target extends keyof ValidationTargets, T extends z.ZodType>(
  target: Target,
  schema: T
) =>
  zValidator(target, schema, (result) => {
    if (!result.success) {
      throw new AppError("VALIDATION_FAILED", "Invalid input", {
        fieldErrors: fieldErrorsFromIssues(result.error.issues),
      })
    }
  })
```

- [ ] **Step 4: Implement health routes, app, route handler**

`server/modules/health/routes.ts`:

```ts
import "server-only"

import { Hono } from "hono"

import type { AppEnv } from "@/server/api/context"
import { pingDb } from "@/server/db/client"

/** Liveness never touches the DB (Docker HEALTHCHECK). Readiness pings Postgres. */
export const healthRoutes = new Hono<AppEnv>()
  .get("/live", (c) => {
    c.header("Cache-Control", "no-store")
    return c.json({ status: "ok" as const }, 200)
  })
  .get("/", async (c) => {
    c.header("Cache-Control", "no-store")
    if (await pingDb())
      return c.json({ status: "ok" as const, db: "ok" as const }, 200)
    return c.json({ status: "unavailable" as const }, 503)
  })
```

`server/api/app.ts`:

```ts
import "server-only"

import { Hono } from "hono"
import { secureHeaders } from "hono/secure-headers"

import type { AppEnv } from "@/server/api/context"
import { limitBody } from "@/server/api/middleware/body-limit"
import { notFoundHandler, onError } from "@/server/api/middleware/error"
import { requestIdMiddleware } from "@/server/api/middleware/request-id"
import { sameOrigin } from "@/server/api/middleware/same-origin"
import { healthRoutes } from "@/server/modules/health/routes"

/**
 * Admin API routes, chained so `hc<AdminApi>` sees every route type.
 * Later phases add `.route("/<resource>", <resource>Routes)` here.
 */
export const adminRoutes = new Hono<AppEnv>()
export type AdminApi = typeof adminRoutes

/** Builds the API. Mount order follows spec §7; Phase 2 adds Better Auth + session middleware. */
export function createApp() {
  const api = new Hono<AppEnv>().basePath("/api")

  // 1. Global
  api.use("*", requestIdMiddleware)
  api.use("*", secureHeaders())
  api.use("*", async (c, next) => {
    c.set("actor", null)
    await next()
    c.header("X-Robots-Tag", "noindex")
  })
  api.onError(onError)
  api.notFound(notFoundHandler)

  // 3. Public endpoints (rate limit added in Phase 7)
  api.use("/v1/public/*", limitBody("public"))

  // 4. Admin endpoints (session + signedIn inserted before sameOrigin in Phase 2)
  api.use("/v1/admin/*", sameOrigin(), limitBody("admin"))
  api.route("/v1/admin", adminRoutes)

  // 5. Health
  api.route("/v1/health", healthRoutes)

  return api
}

export const app = createApp()
```

`app/api/[...route]/route.ts`:

```ts
import { app } from "@/server/api/app"

const handler = (req: Request) => app.fetch(req)

export {
  handler as DELETE,
  handler as GET,
  handler as OPTIONS,
  handler as PATCH,
  handler as POST,
  handler as PUT,
}
```

(No `dynamic`/`revalidate` exports: they become build errors once `cacheComponents` is enabled in Task 3.4. A catch-all route handler is never prerendered.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS — `error-envelope.test.ts` (16 tests) in unit, `health.test.ts` (3 tests) in integration, all earlier tests still green.

- [ ] **Step 6: Build without env, then smoke the real server**

Run: `env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: success; route table lists `ƒ /api/[...route]`.

Smoke (port 3105 avoids Phase 0's 3100):

```bash
DATABASE_URL=postgres://sp:sp@127.0.0.1:5432/sp_dev BETTER_AUTH_SECRET=dev-only-secret-change-me-0123456789abcdef BETTER_AUTH_URL=http://localhost:3105 pnpm start -p 3105 & SERVER=$!
until curl -fsS http://127.0.0.1:3105/api/v1/health/live >/dev/null 2>&1; do sleep 1; done
curl -sS http://127.0.0.1:3105/api/v1/health/live; echo
curl -sS http://127.0.0.1:3105/api/v1/health; echo
curl -sS http://127.0.0.1:3105/api/v1/nope; echo
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3105/
kill $SERVER
```

Expected: `{"status":"ok"}`, `{"status":"ok","db":"ok"}`, `{"error":{"code":"NOT_FOUND","message":"Route not found","requestId":"…"}}`, `200` (public home unchanged).

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add "app/api/[...route]/route.ts" server/api server/modules/health tests/unit/api tests/integration/api
git commit -m "feat: add hono api skeleton with error envelope and health

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Docker entrypoint + compose + build without env (master Task 1.6)

**Files:**
- Create: `scripts/build-scripts.ts`
- Test: `tests/unit/scripts-bundle.test.ts`
- Modify: `package.json` (script `scripts:build`)
- Modify: `Dockerfile`
- Create: `docker-entrypoint.sh` (executable)
- Modify: `docker-compose.yml`
- Modify: `.dockerignore`
- Modify: `.gitignore` (append `/scripts/dist/`)

**Interfaces:**
- Consumes: `scripts/migrate.ts` (Task 4), migrations folder `server/db/migrations` (Task 4), `/api/v1/health/live` (Task 5).
- Produces:
  - `export const SCRIPT_ENTRIES = ["migrate"] as const` — later phases append `"seed"`, `"admin-create"`, `"owner-recover"`, `"demo-seed"`, `"secrets-rotate"`, `"db-sync"`, `"backup"`, `"restore-drill"` as they create those scripts.
  - `export async function buildScripts(outdir = "scripts/dist"): Promise<string[]>` → `scripts/dist/<name>.mjs` (self-contained ESM, `server-only` stubbed, `pg-native` external).
  - Image layout: `/app/server.js`, `/app/scripts/dist/*.mjs`, `/app/server/db/migrations/**`, `/app/docker-entrypoint.sh`, `/data` (owned by `nextjs`, volume), `pg_dump`/`pg_restore` 17 on PATH. Entrypoint: `node scripts/dist/migrate.mjs` then `exec "$@"` (default `node server.js`). Scripts in a running container: `docker exec <c> node scripts/dist/<name>.mjs …`.

- [ ] **Step 1: Write the failing test**

`tests/unit/scripts-bundle.test.ts`:

```ts
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { buildScripts, SCRIPT_ENTRIES } from "../../scripts/build-scripts"

// The bundle is written to a temp dir outside the repo, so running it there
// proves it needs no node_modules (the production image has none for scripts).
const outdir = mkdtempSync(join(tmpdir(), "sp-scripts-"))
let files: string[] = []

beforeAll(async () => {
  files = await buildScripts(outdir)
}, 60_000)
afterAll(() => rmSync(outdir, { recursive: true, force: true }))

describe("scripts bundle", () => {
  it("emits one .mjs per entry", () => {
    expect(files.map((f) => f.slice(outdir.length + 1))).toEqual(
      SCRIPT_ENTRIES.map((n) => `${n}.mjs`)
    )
  })

  it("stubs server-only (its throwing module is not in the bundle)", () => {
    const code = readFileSync(join(outdir, "migrate.mjs"), "utf8")
    expect(code).not.toContain("cannot be imported from a Client Component")
  })

  it("migrate.mjs runs standalone and exits 1 listing every missing env var", () => {
    const env = { ...process.env }
    for (const key of ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"])
      delete env[key]
    const run = spawnSync(process.execPath, [join(outdir, "migrate.mjs")], {
      cwd: outdir,
      env,
      encoding: "utf8",
    })
    expect(run.status).toBe(1)
    expect(run.stderr).toContain("[migrate] Invalid environment configuration:")
    expect(run.stderr).toContain("  - DATABASE_URL: is required")
    expect(run.stderr).toContain("  - BETTER_AUTH_SECRET: is required")
    expect(run.stderr).toContain("  - BETTER_AUTH_URL: is required")
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:unit tests/unit/scripts-bundle.test.ts`
Expected: FAIL — `Failed to resolve import "../../scripts/build-scripts"`.

- [ ] **Step 3: Implement the bundler**

`scripts/build-scripts.ts`:

```ts
// Bundles the operational scripts into self-contained ESM files for the
// production image (which has no tsx and only the traced node_modules).
//   pnpm scripts:build  →  scripts/dist/<name>.mjs
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

import { build, type Plugin } from "esbuild"

/** Scripts shipped in the image. Later phases append their script names. */
export const SCRIPT_ENTRIES = ["migrate"] as const

/** `server-only` throws outside Next's react-server bundles; scripts get an empty module. */
const serverOnlyStub: Plugin = {
  name: "server-only-stub",
  setup(b) {
    b.onResolve({ filter: /^server-only$/ }, () => ({
      path: "server-only",
      namespace: "server-only-stub",
    }))
    b.onLoad({ filter: /.*/, namespace: "server-only-stub" }, () => ({
      contents: "export {}",
      loader: "js",
    }))
  },
}

export async function buildScripts(
  outdir = resolve("scripts/dist")
): Promise<string[]> {
  await build({
    entryPoints: SCRIPT_ENTRIES.map((name) => resolve("scripts", `${name}.ts`)),
    outdir,
    outExtension: { ".js": ".mjs" },
    bundle: true,
    platform: "node",
    target: "node22",
    format: "esm",
    tsconfig: resolve("tsconfig.json"),
    // pg lazily requires the optional native binding; it is never installed.
    external: ["pg-native"],
    // CommonJS dependencies (pg) call require(); give the ESM bundle one.
    banner: {
      js: 'import { createRequire as __spCreateRequire } from "node:module"; const require = __spCreateRequire(import.meta.url);',
    },
    plugins: [serverOnlyStub],
    legalComments: "none",
    logLevel: "warning",
  })
  return SCRIPT_ENTRIES.map((name) => resolve(outdir, `${name}.mjs`))
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const files = await buildScripts()
  console.log(`[scripts:build] ${files.length} script(s) → scripts/dist`)
}
```

```bash
pnpm pkg set scripts.scripts:build="tsx scripts/build-scripts.ts"
grep -qxF '/scripts/dist/' .gitignore || printf '\n# bundled ops scripts (Docker builder output)\n/scripts/dist/\n' >> .gitignore
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:unit tests/unit/scripts-bundle.test.ts`
Expected: PASS (3 tests).

Run: `pnpm scripts:build && ls scripts/dist`
Expected: `[scripts:build] 1 script(s) → scripts/dist` and `migrate.mjs`; `git status --short scripts/dist` prints nothing (ignored).

- [ ] **Step 5: Entrypoint, Dockerfile, compose, dockerignore**

`docker-entrypoint.sh` (then `chmod +x docker-entrypoint.sh`):

```sh
#!/bin/sh
# Container entrypoint: apply pending database migrations, then exec the
# command (default CMD: node server.js). A failed migration stops the start,
# so the old container keeps serving until the problem is fixed.
set -eu

echo "[entrypoint] applying database migrations"
node scripts/dist/migrate.mjs

echo "[entrypoint] starting: $*"
exec "$@"
```

`Dockerfile` (full file; same three stages and comment style as before):

```dockerfile
# syntax=docker/dockerfile:1

# Production image for security.raynx.ie, built from Next.js standalone output.
# Build:  docker build -t security-partners-web .
# Run:    docker run -p 3000:3000 \
#           -e DATABASE_URL=postgres://… -e BETTER_AUTH_SECRET=… -e BETTER_AUTH_URL=https://… \
#           -v security-data:/data security-partners-web
# The image builds without any env vars or database; migrations run when the
# container starts (docker-entrypoint.sh).

ARG NODE_VERSION=22-alpine

# 1. Install dependencies from the lockfile only, so this layer is cached
#    until package.json / pnpm-lock.yaml change.
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# 2. Build the app. next/font downloads Google Fonts here, so the build
#    needs network access. Then bundle the operational scripts (migrate, …)
#    into self-contained files, because the runtime image has no tsx and only
#    the node_modules that Next traced for server.js.
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build && pnpm scripts:build

# 3. Minimal runtime: the standalone server, static assets, public/, the
#    bundled scripts and the SQL migrations they apply.
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# pg_dump/pg_restore 17 for the backup job and restore drill (Phase 10).
RUN apk add --no-cache postgresql17-client

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs \
    && mkdir -p /data && chown nextjs:nodejs /data

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/scripts/dist ./scripts/dist
COPY --from=builder --chown=nextjs:nodejs /app/server/db/migrations ./server/db/migrations
COPY --chown=nextjs:nodejs --chmod=755 docker-entrypoint.sh ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000

# Uploads (/data/uploads) and local backups (/data/backups) until R2 is configured.
VOLUME ["/data"]

# Liveness only: never touches the database.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health/live >/dev/null || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
```

`docker-compose.yml` (full file):

```yaml
# Production stack for security.raynx.ie
# Handled by Dokploy: Traefik manages reverse proxy, SSL (Let's Encrypt), and routes to port 3000.
# Postgres 17 runs as a separate Dokploy database service. Set exactly these
# three variables in the Dokploy environment tab (nothing else is read):
#   DATABASE_URL        postgres://<user>:<password>@<dokploy-db-host>:5432/<db>
#   BETTER_AUTH_SECRET  >= 32 random chars (openssl rand -base64 48); also derives the encryption keys
#   BETTER_AUTH_URL     https://security.raynx.ie
# The container applies pending migrations on start (docker-entrypoint.sh).

services:
  security-web:
    image: ghcr.io/mdnhs/security-partners:latest
    restart: unless-stopped
    expose:
      - "3000"
    environment:
      DATABASE_URL: ${DATABASE_URL:?set DATABASE_URL in Dokploy}
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET:?set BETTER_AUTH_SECRET in Dokploy}
      BETTER_AUTH_URL: ${BETTER_AUTH_URL:?set BETTER_AUTH_URL in Dokploy}
    volumes:
      # Uploads and local backups until R2 is configured in the admin.
      - security-data:/data

volumes:
  security-data:
```

`.dockerignore` (full file):

```
.git
.next
node_modules
npm-debug.log*
pnpm-debug.log*
tsconfig.tsbuildinfo
.env*
!.env.example
.mcp.json
.claude
.superpowers
.vscode
.idea
.DS_Store
Dockerfile
docker-compose.yml
docker-compose.dev.yml
Caddyfile
README.md
AGENTS.original.md
.data
scripts/dist
coverage
.vitest
test-results
playwright-report
tests/visual/__screenshots__
```

- [ ] **Step 6: Validate compose interpolation**

```bash
DATABASE_URL=postgres://u:p@db:5432/sp BETTER_AUTH_SECRET=0123456789abcdef0123456789abcdef BETTER_AUTH_URL=https://security.raynx.ie docker compose -f docker-compose.yml config --quiet && echo "compose ok"
env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL docker compose -f docker-compose.yml config --quiet; echo "exit=$?"
```

Expected: `compose ok`; then an error naming `set DATABASE_URL in Dokploy` (required variable missing) and `exit=1`.

- [ ] **Step 7: Docker build + smoke against the dev Postgres**

```bash
pnpm db:up
docker build -t security-partners-web:phase1 .
```

Expected: build succeeds with no build args or env (log shows `pnpm build` then `[scripts:build] 1 script(s) → scripts/dist`).

```bash
docker run --rm security-partners-web:phase1; echo "exit=$?"
```

Expected: `[entrypoint] applying database migrations`, then `[migrate] Invalid environment configuration:` with the three `is required` lines, and `exit=1`.

```bash
docker run --rm --entrypoint pg_dump security-partners-web:phase1 --version
```

Expected: `pg_dump (PostgreSQL) 17.x`.

```bash
docker compose -f docker-compose.dev.yml exec -T postgres dropdb -U sp --if-exists sp_smoke
docker compose -f docker-compose.dev.yml exec -T postgres createdb -U sp sp_smoke
docker run -d --name sp-smoke -p 3999:3000 --add-host=host.docker.internal:host-gateway \
  -e DATABASE_URL=postgres://sp:sp@host.docker.internal:5432/sp_smoke \
  -e BETTER_AUTH_SECRET=smoke-secret-0123456789abcdef0123456789 \
  -e BETTER_AUTH_URL=http://localhost:3999 \
  security-partners-web:phase1
until curl -fsS http://127.0.0.1:3999/api/v1/health/live >/dev/null 2>&1; do sleep 1; done
curl -sS http://127.0.0.1:3999/api/v1/health/live; echo
curl -sS http://127.0.0.1:3999/api/v1/health; echo
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3999/
docker logs sp-smoke 2>&1 | head -4
docker exec sp-smoke wget -qO- http://127.0.0.1:3000/api/v1/health/live; echo
docker exec sp-smoke sh -c 'id -un; ls -ld /data'
docker compose -f docker-compose.dev.yml exec -T postgres psql -U sp -d sp_smoke -Atc "select count(*) from drizzle.__drizzle_migrations"
docker rm -f sp-smoke
docker compose -f docker-compose.dev.yml exec -T postgres dropdb -U sp sp_smoke
```

Expected, in order: `{"status":"ok"}`; `{"status":"ok","db":"ok"}`; `200`; logs start with `[entrypoint] applying database migrations`, `[migrate] migrations applied`, `[entrypoint] starting: node server.js`; the HEALTHCHECK command prints `{"status":"ok"}`; `nextjs` and `/data` owned by `nextjs nodejs`; migration count `1`.

- [ ] **Step 8: Phase gate**

Run: `pnpm lint && pnpm typecheck && pnpm test && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: all exit 0 (`pnpm test` needs `pnpm db:up`).

- [ ] **Step 9: Commit**

```bash
git add scripts/build-scripts.ts tests/unit/scripts-bundle.test.ts package.json Dockerfile docker-entrypoint.sh docker-compose.yml .dockerignore .gitignore
git commit -m "build: run migrations in docker entrypoint and bundle scripts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Verify the entrypoint kept its executable bit: `git ls-files -s docker-entrypoint.sh` starts with `100755`.
