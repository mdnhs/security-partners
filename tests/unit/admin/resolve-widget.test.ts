import { describe, expect, it } from "vitest"
import { z } from "zod"

import {
  type EditorMeta,
  humanize,
  metaFor,
  metaKey,
} from "@/components/admin/schema-form/editor-meta"
import { emptyValue } from "@/components/admin/schema-form/empty-value"
import {
  arrayBounds,
  resolveWidget,
} from "@/components/admin/schema-form/resolve-widget"
import { SEO_FIELDS_META } from "@/components/admin/seo/seo-meta"
import {
  link,
  mediaRef,
  paragraphsText,
  richText,
  seo,
  text,
} from "@/lib/schemas/common"
import { categorySchema } from "@/lib/schemas/content/category"
import { clientSchema } from "@/lib/schemas/content/client"
import { groupCompanySchema } from "@/lib/schemas/content/group-company"
import { serviceSchema } from "@/lib/schemas/content/service"
import { teamMemberSchema } from "@/lib/schemas/content/team-member"
import { settingsSchemas } from "@/lib/schemas/settings"
import * as customCodeModule from "@/lib/schemas/settings/custom-code"
import { templateEditorMeta } from "@/templates/editor-meta"
import { templates } from "@/templates/registry"

/** Resolves every node of a schema like SchemaForm does; returns path → kind. */
function walk(
  schema: z.ZodType,
  meta: EditorMeta,
  path = "",
  name = ""
): Record<string, string> {
  const field = resolveWidget(schema, metaFor(meta, path), name, path)
  const out: Record<string, string> = path
    ? { [metaKey(path)]: field.kind }
    : {}
  if (field.kind === "group")
    for (const [key, child] of Object.entries(
      (field.schema as z.ZodObject).shape
    ))
      Object.assign(
        out,
        walk(child as z.ZodType, meta, path ? `${path}.${key}` : key, key)
      )
  if (field.kind === "list")
    Object.assign(
      out,
      walk(
        (field.schema as z.ZodArray<z.ZodType>).element,
        meta,
        `${path}.0`,
        "Item 1"
      )
    )
  return out
}

describe("resolveWidget covers every shipped schema (master 4.3)", () => {
  it.each(Object.entries(templates))(
    "template %s has a widget for every field",
    (name, { schema }) => {
      const kinds = walk(
        schema,
        templateEditorMeta[name as keyof typeof templates]
      )
      expect(Object.keys(kinds).length).toBeGreaterThan(3)
    }
  )

  it.each(Object.entries(settingsSchemas))(
    "settings %s has a widget for every field",
    (_key, schema) => {
      expect(() => walk(schema, { fields: {} })).not.toThrow()
    }
  )

  it.each([
    ["service", serviceSchema],
    ["team member", teamMemberSchema],
    ["client", clientSchema],
    ["group company", groupCompanySchema],
    ["category", categorySchema],
  ] as const)("%s schema has a widget for every field", (_name, schema) => {
    expect(() => walk(schema, { fields: {} })).not.toThrow()
  })

  it("maps the home template as designed", () => {
    const kinds = walk(templates.home.schema, templateEditorMeta.home)
    expect(kinds).toMatchObject({
      hero: "group",
      "hero.heading": "text",
      "hero.subheading": "textarea",
      "hero.backgroundImage": "media",
      "hero.primaryCta": "link",
      "hero.stats": "list",
      "hero.stats[]": "group",
      "hero.stats[].count": "number",
      "blog.count": "number",
    })
    expect(
      walk(templates.blog.schema, templateEditorMeta.blog).featuredArticle
    ).toBe("collection")
    expect(walk(templates.legal.schema, templateEditorMeta.legal).body).toBe(
      "richText"
    )
  })

  it("identifies shared schemas and unwraps optional/nullable", () => {
    expect(
      resolveWidget(mediaRef.nullable(), {}, "logo", "logo")
    ).toMatchObject({ kind: "media", nullable: true })
    expect(resolveWidget(paragraphsText, {}, "body", "body")).toMatchObject({
      kind: "richText",
      richTextMode: "paragraphs",
    })
    expect(resolveWidget(richText, {}, "body", "body").richTextMode).toBe(
      "full"
    )
    expect(resolveWidget(link, {}, "cta", "cta").kind).toBe("link")
    expect(resolveWidget(z.email(), {}, "email", "email")).toMatchObject({
      kind: "text",
      format: "email",
    })
    expect(resolveWidget(z.number().optional(), {}, "n", "n")).toMatchObject({
      kind: "number",
      optional: true,
    })
    expect(resolveWidget(z.boolean(), {}, "enabled", "enabled").kind).toBe(
      "toggle"
    )
    expect(resolveWidget(z.enum(["a", "b"]), {}, "pick", "pick").kind).toBe(
      "select"
    )
    expect(resolveWidget(text, { widget: "textarea" }, "x", "x").kind).toBe(
      "textarea"
    )
    // radio: opt-in, ≤ 4 options; more options fall back to a select.
    expect(
      resolveWidget(z.enum(["a", "b", "c", "d"]), { widget: "radio" }, "p", "p")
        .kind
    ).toBe("radio")
    expect(
      resolveWidget(
        z.enum(["a", "b", "c", "d", "e"]).optional(),
        { widget: "radio" },
        "p",
        "p"
      ).kind
    ).toBe("select")
    // An array of an enum is a checkbox group; other arrays stay lists.
    expect(
      resolveWidget(z.array(z.enum(["admin", "editor"])), {}, "roles", "roles")
        .kind
    ).toBe("checkboxes")
    expect(resolveWidget(z.array(z.string()), {}, "tags", "tags").kind).toBe(
      "list"
    )
    expect(() => resolveWidget(z.date(), {}, "when", "a.when")).toThrow(
      'No widget for field "a.when"'
    )
  })

  it("edits a pipe as its input schema (seo.canonical)", () => {
    const piped = z.string().max(20).pipe(z.url()).optional()
    expect(resolveWidget(piped, {}, "canonical", "canonical")).toMatchObject({
      kind: "text",
      optional: true,
    })
    expect(
      resolveWidget(
        z.string().transform((v) => v.trim()),
        {},
        "body",
        "body"
      ).kind
    ).toBe("textarea")
    expect(walk(seo, SEO_FIELDS_META)).toMatchObject({
      title: "text",
      description: "textarea",
      canonical: "text",
      ogImage: "media",
      noindex: "toggle",
    })
    expect(
      resolveWidget(
        seo.shape.canonical,
        SEO_FIELDS_META.fields.canonical!,
        "canonical",
        "canonical"
      )
    ).toMatchObject({ kind: "text", icon: "url", optional: true })
  })
})

describe("editor meta helpers", () => {
  it("normalises list indexes and humanises keys", () => {
    expect(metaKey("hero.stats.2.value")).toBe("hero.stats[].value")
    expect(metaKey("highlights.10")).toBe("highlights[]")
    expect(humanize("primaryCta")).toBe("Primary cta")
    expect(humanize("phone24hLabel")).toBe("Phone24h label")
  })

  it("reads array bounds and builds blank values", () => {
    expect(arrayBounds(z.array(text).min(1).max(4))).toEqual({ min: 1, max: 4 })
    expect(
      emptyValue(
        z.object({
          a: text,
          b: z.array(text).min(2),
          c: mediaRef,
          d: z.number().optional(),
          e: link,
          f: z.boolean(),
          g: text.nullable(),
        })
      )
    ).toEqual({
      a: "",
      b: ["", ""],
      c: null,
      e: { label: "", href: "" },
      f: false,
      g: null,
    })
    expect(emptyValue(richText)).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    })
  })
})

describe("custom code snippets in SchemaForm (D2.3)", () => {
  it("a new snippet starts with a fresh, valid uuid; other strings stay empty", () => {
    const { snippet } = customCodeModule
    const a = emptyValue(snippet) as { id: string; name: string }
    const b = emptyValue(snippet) as { id: string }
    expect(z.uuid().safeParse(a.id).success).toBe(true)
    expect(a.id).not.toBe(b.id)
    expect(a.name).toBe("")
    expect(emptyValue(z.string())).toBe("")
  })

  it("meta.required makes a defaulted field required (review D2.2 I1)", () => {
    const field = resolveWidget(
      z.number().default(1),
      { required: true },
      "version",
      "version"
    )
    expect(field.optional).toBe(false)
    expect(
      resolveWidget(z.number().default(1), {}, "version", "version").optional
    ).toBe(true)
  })
})
