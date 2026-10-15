import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return walk(path)
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : []
  })
}

describe("public content comes from the database (master Task 3.5)", () => {
  it("components/*/data.ts are gone", () => {
    for (const dir of ["home", "about", "services", "team"])
      expect(existsSync(`components/${dir}/data.ts`), dir).toBe(false)
  })

  it("nothing in app/ or components/ imports a data module", () => {
    const offenders = [...walk("app"), ...walk("components")].filter((file) =>
      /from "[^"]*\/data"/.test(readFileSync(file, "utf8"))
    )
    expect(offenders).toEqual([])
  })
})
