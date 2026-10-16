import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { link } from "@/lib/schemas/common"

import { makeQueryClient } from "@/components/admin/providers"
import { settingsEditorMeta } from "@/components/admin/settings/settings-meta"
import { serviceEditorMeta } from "@/components/admin/services/service-meta"
import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"
import { SchemaForm } from "@/components/admin/schema-form/schema-form"
import {
  destinationKind,
  fileName,
} from "@/components/admin/schema-form/widgets/pickers"
import {
  groupCardIds,
  pairHalves,
} from "@/components/admin/schema-form/widgets/group"
import { itemSummary } from "@/components/admin/schema-form/widgets/list"
import { EDITABLE_SETTINGS_KEYS } from "@/lib/admin/settings-keys"
import { serviceContent } from "@/lib/schemas/content/service"
import { settingsSchemas } from "@/lib/schemas/settings"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { pagesFixture } from "@/server/db/seed/fixtures/pages"
import { settingsFixture } from "@/server/db/seed/fixtures/settings"
import { templateEditorMeta } from "@/templates/editor-meta"
import { PAGES, templateSchemaFor, templates } from "@/templates/registry"

const settings = settingsFixture(fixtureMediaLookup)
const pages = pagesFixture(fixtureMediaLookup)

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({ items: [], page: 1, pageSize: 24, total: 0 }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    )
  )
})

function renderSchema(
  schema: z.ZodObject,
  meta: EditorMeta,
  value: unknown,
  props: { errors?: Record<string, string[]>; sectionTabs?: string } = {}
) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <SchemaForm
        schema={schema}
        meta={meta}
        value={structuredClone(value) as never}
        onChange={vi.fn()}
        {...props}
      />
    </QueryClientProvider>
  )
}

const width = (input: HTMLElement) =>
  input.closest("[data-width]")?.getAttribute("data-width")

describe("SchemaForm layout (JW field groups)", () => {
  it("shows Contact details as titled cards of related fields", () => {
    renderSchema(
      settingsSchemas.contact,
      settingsEditorMeta.contact,
      settings.contact
    )
    const phones = screen.getByRole("region", { name: "Phone numbers" })
    expect(
      within(phones).getByText(/tel: links are made from them/)
    ).toBeInTheDocument()
    expect(
      within(phones).getByRole("textbox", { name: "24-hour number" })
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole("region", { name: "Email" })).getByRole(
        "textbox",
        { name: "Main email" }
      )
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole("region", { name: "Address & map" })).getByRole(
        "textbox",
        { name: "Map link" }
      )
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole("region", { name: "Opening hours" })).getByRole(
        "textbox",
        { name: "Office hours" }
      )
    ).toBeInTheDocument()
  })

  it("puts short fields side by side and long ones across the row", () => {
    renderSchema(
      settingsSchemas.contact,
      settingsEditorMeta.contact,
      settings.contact
    )
    expect(width(screen.getByRole("textbox", { name: "24-hour number" }))).toBe(
      "half"
    )
    expect(width(screen.getByRole("textbox", { name: "Office number" }))).toBe(
      "half"
    )
    expect(width(screen.getByRole("textbox", { name: "Map link" }))).toBe(
      "full"
    )
    expect(width(screen.getByRole("textbox", { name: "Office hours" }))).toBe(
      "full"
    )
  })

  it("says once that fields are required; marks only optional ones", () => {
    renderSchema(settingsSchemas.site, settingsEditorMeta.site, settings.site)
    expect(
      screen.getByText("All fields are required unless marked optional.")
    ).toBeInTheDocument()
    const name = screen.getByRole("textbox", { name: "Site name" })
    expect(name).toHaveAttribute("aria-required", "true")
    expect(
      document.querySelector(`label[for="${name.id}"]`)
    ).not.toHaveTextContent("optional")
    const url = screen.getByRole("textbox", { name: /Production URL/ })
    expect(url).not.toHaveAttribute("aria-required")
    expect(document.querySelector(`label[for="${url.id}"]`)).toHaveTextContent(
      "(optional)"
    )
  })

  it("leaves the note out when nothing is required", () => {
    renderSchema(
      z.object({ note: z.string().optional(), on: z.boolean() }),
      { fields: {} },
      { on: false }
    )
    expect(screen.queryByText(/required unless marked optional/)).toBeNull()
  })

  it("requires a link's text and destination only when the link is", () => {
    renderSchema(
      z.object({ cta: link, extra: link.nullable() }),
      { fields: {} },
      { cta: { label: "Go", href: "/" }, extra: null }
    )
    const cta = screen.getByRole("group", { name: "Cta" })
    expect(within(cta).getByRole("textbox", { name: "Text" })).toHaveAttribute(
      "aria-required",
      "true"
    )
    const extra = screen.getByRole("group", { name: /Extra/ })
    expect(
      within(extra).getByRole("textbox", { name: "Link to" })
    ).not.toHaveAttribute("aria-required")
  })

  it("shows icons in phone and email inputs", () => {
    renderSchema(
      settingsSchemas.contact,
      settingsEditorMeta.contact,
      settings.contact
    )
    const phone = screen.getByRole("textbox", { name: "24-hour number" })
    expect(phone.parentElement?.querySelector("svg")).toHaveAttribute(
      "aria-hidden"
    )
    const email = screen.getByRole("textbox", { name: "Main email" })
    expect(email.parentElement?.querySelector("svg")).toHaveAttribute(
      "aria-hidden"
    )
  })

  it("splits a section into titled parts (home hero)", () => {
    renderSchema(
      templateSchemaFor("home"),
      templateEditorMeta[PAGES.home],
      pages.home.data
    )
    const hero = screen.getByRole("region", { name: "Hero" })
    for (const name of ["Text", "Background", "Buttons", "Stats"])
      expect(within(hero).getByRole("region", { name })).toBeInTheDocument()
    expect(
      within(within(hero).getByRole("region", { name: "Text" })).getByRole(
        "textbox",
        { name: "Heading" }
      )
    ).toBeInTheDocument()
  })

  it("summarises and collapses list items", async () => {
    const user = userEvent.setup()
    renderSchema(
      templateSchemaFor("home"),
      templateEditorMeta[PAGES.home],
      pages.home.data
    )
    const stats = screen.getByRole("group", { name: "Stats" })
    const first = within(stats).getByRole("listitem", { name: "Stat 1" })
    const [stat] = pages.home.data.hero.stats
    const toggle = within(first).getByRole("button", { expanded: true })
    // The naming field (itemLabel "label") leads the summary.
    expect(toggle).toHaveTextContent(`Stat 1${stat.label} · ${stat.value}`)
    const label = within(first).getByRole("textbox", { name: "Label" })
    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(label).not.toBeVisible()
    await user.click(toggle)
    expect(label).toBeVisible()
    // 44 px on touch screens (WCAG 2.5.8 / brief).
    expect(toggle).toHaveClass("pointer-coarse:min-h-11")
  })

  it("keeps an item with errors open and says why", () => {
    renderSchema(
      templateSchemaFor("home"),
      templateEditorMeta[PAGES.home],
      pages.home.data,
      { errors: { "hero.stats.0.label": ["Required"] } }
    )
    const first = within(
      screen.getByRole("group", { name: "Stats" })
    ).getByRole("listitem", { name: "Stat 1" })
    const toggle = within(first).getByRole("button", { expanded: true })
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveTextContent("fix its errors to collapse it")
  })

  it("offers a dashed Add button and an empty-list message", async () => {
    const user = userEvent.setup()
    const schema = z.object({ tags: z.array(z.string()) })
    renderSchema(
      schema,
      { fields: { tags: { itemName: "Tag" } } },
      { tags: [] }
    )
    expect(screen.getByText(/No tags yet/)).toBeInTheDocument()
    const add = screen.getByRole("button", { name: "Add tag" })
    expect(add).toHaveClass("border-dashed")
    await user.click(add)
    expect(screen.queryByText(/No tags yet/)).toBeNull()
  })

  it("uses the plural from meta where adding s is wrong", () => {
    renderSchema(
      z.object({ qualities: z.array(z.string()) }),
      {
        fields: {
          qualities: { itemName: "Quality", itemNamePlural: "Qualities" },
        },
      },
      { qualities: [] }
    )
    expect(screen.getByText(/No qualities yet/)).toBeInTheDocument()
  })

  it("focuses the first invalid control when the error has no input of its own", async () => {
    // A list's own error (min items) registers no input: setFocus does
    // nothing, so the jump falls back to a control of that list.
    const schema = z.object({
      first: z.object({ name: z.string() }),
      second: z.object({ items: z.array(z.string()).min(1) }),
    })
    const { rerender } = renderSchema(
      schema,
      { fields: {} },
      { first: { name: "a" }, second: { items: [] } },
      { sectionTabs: "Sections" }
    )
    const errors = { "second.items": ["Add at least one"] }
    rerender(
      <QueryClientProvider client={makeQueryClient()}>
        <SchemaForm
          schema={schema}
          meta={{ fields: {} }}
          value={{ first: { name: "a" }, second: { items: [] } }}
          onChange={vi.fn()}
          sectionTabs="Sections"
          errors={errors}
        />
      </QueryClientProvider>
    )
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /Second/ })).toHaveAttribute(
        "aria-selected",
        "true"
      )
    )
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Add item" })).toHaveFocus()
    )
  })
})

describe("field layout helpers", () => {
  it("pairs half-width fields and widens one left alone", () => {
    expect(pairHalves(["half", "half", "half", "full", "half"])).toEqual([
      "half",
      "half",
      "full",
      "full",
      "full",
    ])
    expect(pairHalves(["half", "full", "half", "half"])).toEqual([
      "full",
      "full",
      "half",
      "half",
    ])
  })

  it("summarises an item by its first texts, keeping its naming field", () => {
    expect(itemSummary({ value: "18+", label: "Years", count: 18 })).toBe(
      "18+ · Years"
    )
    expect(itemSummary({ href: "/blog", label: "Blog" }, "label")).toBe(
      "Blog · /blog"
    )
    expect(itemSummary({ a: "one", b: "two", title: "Name" }, "title")).toBe(
      "Name · one"
    )
    expect(itemSummary("text")).toBe("")
  })

  it("reads a file name from a URL, also a malformed one", () => {
    expect(fileName("/media/2026/hero%20banner.jpg?v=2")).toBe(
      "hero banner.jpg"
    )
    expect(fileName("/media/100%.jpg")).toBe("100%.jpg")
    expect(fileName(undefined)).toBe("")
  })

  it("ids root cards by title slug, unique within the form", () => {
    expect(
      groupCardIds(
        "sf",
        [
          { title: "Address & map", fields: ["a"] },
          { title: "Address & map", fields: ["b"] },
          { title: "!!", fields: ["c"] },
        ],
        [{ section: "hero" }, { run: ["d", "e"] }]
      )
    ).toEqual({
      groups: ["sf-group-address-map", "sf-group-address-map-2", "sf-group-c"],
      blocks: ["", "sf-group-d"],
    })
  })

  it("describes where a link goes", () => {
    expect(destinationKind("/contact")).toBe("A page on this site.")
    expect(destinationKind("tel:123")).toBe("Starts a phone call.")
    expect(destinationKind("https://x.ie")).toBe("Another website.")
    expect(destinationKind("{officeHref}")).toBe(
      "Filled in from Contact details."
    )
    expect(destinationKind("")).toBeNull()
  })
})

describe("editor meta groups", () => {
  const metas: [string, EditorMeta, z.ZodObject][] = [
    ...EDITABLE_SETTINGS_KEYS.map(
      (key) =>
        [
          `settings ${key}`,
          settingsEditorMeta[key],
          settingsSchemas[key] as z.ZodObject,
        ] as [string, EditorMeta, z.ZodObject]
    ),
    ...Object.entries(templates).map(
      ([name, template]) =>
        [
          `template ${name}`,
          templateEditorMeta[name as keyof typeof templates],
          template.schema as z.ZodObject,
        ] as [string, EditorMeta, z.ZodObject]
    ),
    ["service", serviceEditorMeta, serviceContent as z.ZodObject],
  ]

  it.each(metas)("%s lists real keys, each once", (_, meta, schema) => {
    for (const [path, groups] of Object.entries(meta.groups ?? {})) {
      let shape = schema.shape as Record<string, z.ZodType>
      for (const key of path ? path.split(".") : [])
        shape = (shape[key] as z.ZodObject).shape as Record<string, z.ZodType>
      const listed = groups.flatMap((group) => group.fields)
      expect(new Set(listed).size).toBe(listed.length)
      for (const key of listed) expect(Object.keys(shape)).toContain(key)
    }
  })
})
