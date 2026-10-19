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

    it("flags server imports from blocks/ (page-builder registry)", async () => {
      expect(
        await boundaryErrors(aliasImport, "blocks/registry.ts")
      ).toHaveLength(1)
      expect(
        await syntaxErrors(
          'export const load = () => import("../server/env")\n',
          "blocks/fixture.ts"
        )
      ).toHaveLength(1)
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

const drizzleImport =
  'import { eq } from "drizzle-orm"\n\nexport const x = eq\n'
const pgCoreImport =
  'import { text } from "drizzle-orm/pg-core"\n\nexport const x = text\n'

describe(
  "lint boundaries: only repos (and server/db, tests) import drizzle-orm",
  { timeout: 30_000 },
  () => {
    it.each([
      "server/modules/pages/service.ts",
      "server/modules/pages/queries.ts",
      "server/lib/fixture.ts",
      "app/(site)/fixture.tsx",
      "components/fixture.tsx",
      "scripts/fixture.ts",
    ])("flags drizzle-orm in %s", async (file) => {
      const errors = await boundaryErrors(drizzleImport, file)
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toContain("server/modules/*/repo.ts")
      expect(await boundaryErrors(pgCoreImport, file)).toHaveLength(1)
    })

    it("flags drizzle-orm in lib/ and still flags server/ imports there", async () => {
      expect(
        await boundaryErrors(drizzleImport, "lib/fixture.ts")
      ).toHaveLength(1)
      expect(await boundaryErrors(aliasImport, "lib/fixture.ts")).toHaveLength(
        1
      )
    })

    it.each([
      "server/modules/pages/repo.ts",
      "server/db/schema/fixture.ts",
      "server/db/seed/index.ts",
      "tests/integration/fixture.test.ts",
    ])("allows drizzle-orm in %s", async (file) => {
      expect(await boundaryErrors(drizzleImport, file)).toEqual([])
    })

    it("flags routes importing a repo (relative or alias)", async () => {
      const relative =
        'import * as repo from "./repo"\n\nexport const x = repo\n'
      const alias =
        'import * as repo from "@/server/modules/users/repo"\n\nexport const x = repo\n'
      expect(
        await boundaryErrors(relative, "server/modules/pages/routes.ts")
      ).toHaveLength(1)
      expect(
        await boundaryErrors(alias, "server/modules/pages/routes.ts")
      ).toHaveLength(1)
      expect(
        await boundaryErrors(relative, "server/modules/pages/service.ts")
      ).toEqual([])
    })
  }
)

async function syntaxErrors(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath })
  return result.messages.filter((m) => m.ruleId === "no-restricted-syntax")
}

describe(
  "lint boundaries: Phase 10 gaps (ledger P01-1, P03-3, P03-6)",
  { timeout: 30_000 },
  () => {
    it("flags dynamic import() of server/ from lib/", async () => {
      const errors = await syntaxErrors(
        'export const load = () => import("@/server/env")\n',
        "lib/fixture.ts"
      )
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toContain("never import server/ code")
    })

    it("flags require() of server/ from lib/", async () => {
      expect(
        await syntaxErrors(
          'export const env = require("../server/env")\n',
          "lib/fixture.ts"
        )
      ).toHaveLength(1)
    })

    it("does not flag dynamic imports of look-alike or lib paths", async () => {
      expect(
        await syntaxErrors(
          'export const a = () => import("@/server-utils")\nexport const b = () => import("@/lib/utils")\n',
          "lib/fixture.ts"
        )
      ).toEqual([])
    })

    it("covers .mjs files under lib/", async () => {
      expect(
        await boundaryErrors(
          'import { getEnv } from "../server/env.js"\n\nexport const x = getEnv\n',
          "lib/fixture.mjs"
        )
      ).toHaveLength(1)
    })

    it("covers templates/registry.ts", async () => {
      expect(
        await boundaryErrors(
          'import { getEnv } from "@/server/env"\n\nexport const x = getEnv\n',
          "templates/registry.ts"
        )
      ).toHaveLength(1)
    })

    it("flags a route importing another module's repo by relative path", async () => {
      expect(
        await boundaryErrors(
          'import { findUserById } from "../users/repo"\n\nexport const x = findUserById\n',
          "server/modules/pages/routes.ts"
        )
      ).toHaveLength(1)
    })

    it("flags drizzle-orm in a .mjs file outside repos", async () => {
      expect(
        await boundaryErrors(
          'import { eq } from "drizzle-orm"\n\nexport const x = eq\n',
          "scripts/fixture.mjs"
        )
      ).toHaveLength(1)
    })

    it("covers template editor metadata (shipped to the admin client)", async () => {
      expect(
        await boundaryErrors(aliasImport, "templates/home/editor-meta.ts")
      ).toHaveLength(1)
      expect(
        await boundaryErrors(aliasImport, "templates/editor-meta.ts")
      ).toHaveLength(1)
    })

    it("flags template-literal import() and require() in isomorphic files", async () => {
      expect(
        await syntaxErrors(
          "const dir = 'server'\nexport const load = () => import(`@/${dir}/env`)\n",
          "lib/fixture.ts"
        )
      ).toHaveLength(1)
      expect(
        await syntaxErrors(
          "const dir = 'server'\nexport const env = require(`../${dir}/env`)\n",
          "templates/registry.ts"
        )
      ).toHaveLength(1)
    })

    it("flags require.resolve and createRequire in isomorphic files", async () => {
      expect(
        await syntaxErrors(
          'export const p = require.resolve("../server/env")\n',
          "lib/fixture.ts"
        )
      ).toHaveLength(1)
      expect(
        (
          await syntaxErrors(
            'import { createRequire } from "node:module"\n\nexport const r = createRequire(import.meta.url)\n',
            "templates/home/schema.ts"
          )
        ).length
      ).toBeGreaterThan(0)
    })

    it("leaves template-literal import() alone outside isomorphic code", async () => {
      expect(
        await syntaxErrors(
          "const name = 'x'\nexport const load = () => import(`./${name}`)\n",
          "components/fixture.ts"
        )
      ).toEqual([])
    })

    it("flags a route importing a repo with a file extension", async () => {
      expect(
        await boundaryErrors(
          'import { findUserById } from "../users/repo.js"\n\nexport const x = findUserById\n',
          "server/modules/pages/routes.ts"
        )
      ).toHaveLength(1)
      expect(
        await boundaryErrors(
          'import { listUsers } from "./repo.ts"\n\nexport const x = listUsers\n',
          "server/modules/users/routes.ts"
        )
      ).toHaveLength(1)
    })

    it("still allows a route to import its own service", async () => {
      expect(
        await boundaryErrors(
          'import { listUsers } from "./service"\n\nexport const x = listUsers\n',
          "server/modules/users/routes.ts"
        )
      ).toEqual([])
    })
  }
)
