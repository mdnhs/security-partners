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
