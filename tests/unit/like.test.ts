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

/**
 * A local LIKE escaper: a named `escapeLike`, or an inline regex class of
 * exactly \ % _ in any order (written `[\\%_]` in source).
 */
function isLikeEscaper(source: string): boolean {
  return (
    /\b(const|function)\s+escapeLike\b/.test(source) ||
    /\[(?=[^\]]*\\\\)(?=[^\]]*%)(?=[^\]]*_)[\\%_]{4}\]/.test(source)
  )
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
      .filter((file) => isLikeEscaper(readFileSync(join(root, file), "utf8")))
    expect(copies).toEqual([])
  })

  it("recognises named and inline escaper copies", () => {
    const inline = String.raw`const p = q.replace(/[\\%_]/g, (m) => "\\" + m)`
    expect(isLikeEscaper(inline)).toBe(true)
    expect(isLikeEscaper(String.raw`s.replace(/[_%\\]/g, f)`)).toBe(true)
    expect(isLikeEscaper("function escapeLike(v: string) {}")).toBe(true)
    expect(isLikeEscaper(String.raw`s.replace(/[%_]/g, f)`)).toBe(false)
  })
})
