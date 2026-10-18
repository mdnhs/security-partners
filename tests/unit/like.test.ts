import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"

import { describe, expect, it } from "vitest"

import { containsPattern, escapeLike } from "@/server/db/like"

/** Every .ts file under `dir`, recursively. */
function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return tsFiles(path)
    return entry.name.endsWith(".ts") ? [path] : []
  })
}

describe("LIKE helpers (ledger P04-9)", () => {
  it("escapes wildcards and the escape character", () => {
    expect(escapeLike(String.raw`50%_off\now`)).toBe(String.raw`50\%\_off\\now`)
    expect(containsPattern("a_b")).toBe(String.raw`%a\_b%`)
  })

  it("is the only LIKE escaper under server/", () => {
    const root = process.cwd()
    const copies = tsFiles(join(root, "server"))
      .map((file) => relative(root, file))
      .filter((file) => file !== join("server", "db", "like.ts"))
      .filter((file) =>
        /\b(const|function)\s+escapeLike\b/.test(
          readFileSync(join(root, file), "utf8")
        )
      )
    expect(copies).toEqual([])
  })
})
