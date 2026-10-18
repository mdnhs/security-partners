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
 * button, and a titled FormCard (a <section> named by its title → region;
 * without a title it is a plain section, which needs a role).
 */
const hasImplicitRole = (name: string, tag: string) =>
  name === "button" ||
  name === "Button" ||
  (name === "FormCard" && /\btitle=/.test(tag))

/**
 * One opening tag that mentions aria-busy. Attribute values may contain
 * arrow functions (`=>`), so `=>` does not end the tag.
 */
const BUSY_TAG = /<[A-Za-z][\w.]*\s(?:=>|[^<>])*?aria-busy(?:=>|[^<>])*>/g

describe("admin loading states are announced (ledger P04-8)", () => {
  it("every element with aria-busy also has a role (aria-label on a generic div is ignored)", () => {
    const offenders: string[] = []
    for (const file of [
      ...files("components/admin"),
      ...files("app/(admin)"),
    ]) {
      const source = readFileSync(file, "utf8")
      for (const tag of source.match(BUSY_TAG) ?? []) {
        const name = tag.slice(1).match(/^[\w.]+/)![0]
        if (hasImplicitRole(name, tag)) continue
        if (!/\brole=/.test(tag)) offenders.push(`${file}: ${tag.slice(0, 80)}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it("the tag pattern reads past arrow functions and only skips titled FormCards", () => {
    const tag = `<div onClick={() => go()} aria-busy="true">`
    expect(tag.match(BUSY_TAG)).toEqual([tag])
    expect(hasImplicitRole("FormCard", `<FormCard title="x" aria-busy>`)).toBe(
      true
    )
    expect(hasImplicitRole("FormCard", `<FormCard aria-busy>`)).toBe(false)
    expect(hasImplicitRole("div", `<div aria-busy>`)).toBe(false)
  })
})
