import { describe, expect, it } from "vitest"
import { z } from "zod"

import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"
import {
  fieldAtPath,
  insertableTextField,
  stringMaxLength,
} from "@/components/admin/schema-form/field-at-path"

const schema = z.object({
  hero: z.object({
    heading: z.string().min(1).max(80),
    subheading: z.string().max(300),
    visible: z.boolean(),
  }),
  highlights: z.array(z.string().max(40)),
  stats: z.array(
    z.object({ value: z.string(), count: z.number(), suffix: z.string() })
  ),
  seo: z.object({ description: z.string().max(155) }).optional(),
})

const meta: EditorMeta = {
  fields: {
    "hero.heading": { label: "Main heading" },
    "stats[].value": { composeFrom: ["count", "suffix"] },
  },
}

describe("fieldAtPath", () => {
  it("resolves object, list and optional paths like the form does", () => {
    const heading = fieldAtPath(schema, meta, "hero.heading")!
    expect(heading).toMatchObject({ kind: "text", label: "Main heading" })
    expect(stringMaxLength(heading.schema)).toBe(80)
    expect(fieldAtPath(schema, meta, "hero.subheading")).toMatchObject({
      kind: "textarea",
      label: "Subheading",
    })
    expect(fieldAtPath(schema, meta, "highlights.1")).toMatchObject({
      kind: "text",
      label: "Highlights 2",
    })
    const description = fieldAtPath(schema, meta, "seo.description")!
    expect(description.kind).toBe("textarea")
    expect(stringMaxLength(description.schema)).toBe(155)
  })

  it("returns null for paths that are not in the schema", () => {
    for (const path of [
      "",
      "hero.nope",
      "hero.heading.x",
      "stats.x",
      "__proto__",
      "hero.__proto__",
    ])
      expect(fieldAtPath(schema, meta, path)).toBeNull()
  })
})

describe("insertableTextField (AI Insert targets)", () => {
  it("accepts plain text and textarea fields only", () => {
    expect(insertableTextField(schema, meta, "hero.heading")).not.toBeNull()
    expect(insertableTextField(schema, meta, "hero.subheading")).not.toBeNull()
    expect(insertableTextField(schema, meta, "hero.visible")).toBeNull()
    expect(insertableTextField(schema, meta, "stats.0.count")).toBeNull()
    // Composed from count + suffix: read-only in the form.
    expect(insertableTextField(schema, meta, "stats.0.value")).toBeNull()
    expect(insertableTextField(schema, meta, "stats.0.suffix")).not.toBeNull()
  })

  it("has no max length when the schema sets none", () => {
    expect(stringMaxLength(z.string())).toBeNull()
  })
})
