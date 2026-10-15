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
