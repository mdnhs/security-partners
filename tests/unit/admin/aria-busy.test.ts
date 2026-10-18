import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return path.endsWith(".tsx") ? [path] : []
  })
}

/**
 * Elements that already have a role without a `role=` attribute: a native
 * button, and FormCard (a <section> named by its title → region).
 */
const IMPLICIT_ROLE = new Set(["button", "Button", "FormCard"])

describe("admin loading states are announced (ledger P04-8)", () => {
  it("every element with aria-busy also has a role (aria-label on a generic div is ignored)", () => {
    const offenders: string[] = []
    for (const file of [
      ...files("components/admin"),
      ...files("app/(admin)"),
    ]) {
      const source = readFileSync(file, "utf8")
      for (const tag of source.match(
        /<[A-Za-z][\w.]*\s[^<>]*?aria-busy[^<>]*>/g
      ) ?? []) {
        const name = tag.slice(1).match(/^[\w.]+/)![0]
        if (IMPLICIT_ROLE.has(name)) continue
        if (!/\brole=/.test(tag)) offenders.push(`${file}: ${tag.slice(0, 80)}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
