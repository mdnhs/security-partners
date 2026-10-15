import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { seo } from "@/lib/schemas/common"
import { articleSchema } from "@/lib/schemas/content/article"
import { categorySchema } from "@/lib/schemas/content/category"
import { clientSchema } from "@/lib/schemas/content/client"
import { groupCompanySchema } from "@/lib/schemas/content/group-company"
import { serviceSchema } from "@/lib/schemas/content/service"
import { teamMemberSchema } from "@/lib/schemas/content/team-member"
import { settingsSchemas, type SettingsKey } from "@/lib/schemas/settings"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { pagesFixture } from "@/server/db/seed/fixtures/pages"
import { PAGE_KEYS, PAGES, templates } from "@/templates/registry"

import { schemaPaths } from "../helpers/schema-paths"

type Entry = { id: string; kind: string; target: string; value: string }
const { entries } = JSON.parse(
  readFileSync("docs/brief-inventory.json", "utf8")
) as { entries: Entry[] }

/** "articles[18-years-…].title" → "articles[].title". */
const normalise = (target: string) => target.replace(/\[[a-z0-9-]+\]/g, "[]")

/** Inventory field paths under `prefix` (prefix stripped), minus collection markers. */
function inventoryPaths(prefix: string): Set<string> {
  return new Set(
    entries
      .map((e) => normalise(e.target))
      .filter((t) => t.startsWith(prefix) && !t.endsWith("[].*"))
      .map((t) => t.slice(prefix.length))
  )
}

/** Values derived at render instead of stored (ruling: *Href from numbers). */
const DERIVED: Record<string, string[]> = {
  "settings.contact.": ["phone24hHref", "officeHref", "operationsMobileHref"],
  "groupCompanies[].": ["phoneHref"],
  // byline from users (name, title); publishedAt/readTimeMinutes are columns
  "articles[].": [
    "author.name",
    "author.role",
    "publishedAt",
    "readTimeMinutes",
  ],
}

function expectInventoryCovered(
  prefix: string,
  schemaPathsOf: ReturnType<typeof schemaPaths>
) {
  const known = new Set([
    ...schemaPathsOf.leaves,
    ...schemaPathsOf.lists,
    ...(DERIVED[prefix] ?? []),
  ])
  const missing = [...inventoryPaths(prefix)].filter((p) => !known.has(p))
  expect(
    missing,
    `inventory fields under ${prefix} with no schema field`
  ).toEqual([])
}

describe("template schemas match docs/brief-inventory.json (master Task 3.2)", () => {
  const fixture = pagesFixture(fixtureMediaLookup)

  it("registry maps the eight pages to seven templates", () => {
    expect(PAGE_KEYS).toEqual([
      "home",
      "about",
      "services",
      "team",
      "blog",
      "contact",
      "privacy",
      "terms",
    ])
    expect(Object.keys(templates).sort()).toEqual([
      "about",
      "blog",
      "contact",
      "home",
      "legal",
      "services",
      "team",
    ])
  })

  it.each(PAGE_KEYS)(
    "pages.%s fixture parses and round-trips unchanged",
    (key) => {
      const schema = templates[PAGES[key]].schema
      expect(schema.parse(fixture[key].data)).toEqual(fixture[key].data)
      expect(seo.parse(fixture[key].seo)).toEqual(fixture[key].seo)
    }
  )

  it.each(["home", "about", "services", "team", "blog", "contact"] as const)(
    "pages.%s: schema leaf paths equal the inventory's fields",
    (key) => {
      const prefix = `pages.${key}.`
      const inventory = new Set(
        [...inventoryPaths(prefix)].filter((p) => !p.startsWith("seo."))
      )
      const paths = schemaPaths(templates[PAGES[key]].schema)
      // every inventory field exists in the schema …
      expect(
        [...inventory].filter(
          (p) => !paths.leaves.has(p) && !paths.lists.has(p)
        )
      ).toEqual([])
      // … and every schema leaf is in the inventory (a list of strings may
      // be recorded as the list itself, e.g. "tags")
      expect(
        [...paths.leaves].filter(
          (p) =>
            !inventory.has(p) &&
            !(p.endsWith("[]") && inventory.has(p.slice(0, -2)))
        )
      ).toEqual([])
    }
  )

  it("page seo.* fields map onto the seo column schema", () => {
    const seoPaths = schemaPaths(seo).leaves
    const seoFields = entries
      .map((e) => e.target)
      .filter((t) => /^pages\.\w+\.seo\./.test(t))
      .map((t) => t.replace(/^pages\.\w+\.seo\./, ""))
    expect(seoFields.length).toBeGreaterThan(0)
    expect(seoFields.filter((f) => !seoPaths.has(f))).toEqual([])
  })

  it("legal pages are new (spec §5.2) and absent from the inventory", () => {
    expect(inventoryPaths("pages.privacy.").size).toBe(0)
    expect(inventoryPaths("pages.terms.").size).toBe(0)
  })
})

describe("settings and collection schemas cover the inventory", () => {
  const settingsKeys = Object.keys(settingsSchemas) as SettingsKey[]

  it("every settings.* target names a known settings key", () => {
    const unknown = entries
      .map((e) => e.target)
      .filter((t) => t.startsWith("settings."))
      .filter((t) => !settingsKeys.some((k) => t.startsWith(`settings.${k}.`)))
    expect(unknown).toEqual([])
  })

  it.each(settingsKeys)("settings.%s", (key) => {
    expectInventoryCovered(
      `settings.${key}.`,
      schemaPaths(settingsSchemas[key])
    )
  })

  it.each([
    ["services[].", serviceSchema],
    ["articles[].", articleSchema],
    ["categories[].", categorySchema],
    ["team[].", teamMemberSchema],
    ["clients[].", clientSchema],
    ["groupCompanies[].", groupCompanySchema],
  ] as const)("%s", (prefix, schema) => {
    expect(inventoryPaths(prefix).size).toBeGreaterThan(0)
    expectInventoryCovered(prefix, schemaPaths(schema))
  })
})
