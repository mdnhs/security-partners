import { QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { makeQueryClient } from "@/components/admin/providers"
import { formTabs } from "@/components/admin/schema-form/form-tabs"
import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"
import { SchemaForm } from "@/components/admin/schema-form/schema-form"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { pagesFixture } from "@/server/db/seed/fixtures/pages"
import { templateEditorMeta } from "@/templates/editor-meta"
import { type PageKey, templateSchemaFor, PAGES } from "@/templates/registry"
import type { HomeTemplate } from "@/templates/home/schema"

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

function renderForm<K extends PageKey>(
  key: K,
  props: { errors?: Record<string, string[]> } = {}
) {
  const onChange = vi.fn()
  const utils = render(
    <QueryClientProvider client={makeQueryClient()}>
      <SchemaForm
        schema={templateSchemaFor(key)}
        meta={templateEditorMeta[PAGES[key]]}
        value={structuredClone(pages[key].data)}
        onChange={onChange}
        errors={props.errors}
      />
    </QueryClientProvider>
  )
  return { ...utils, onChange }
}

const lastValue = (onChange: ReturnType<typeof vi.fn>) =>
  onChange.mock.calls.at(-1)![0] as HomeTemplate

describe("SchemaForm (master 4.3)", () => {
  it.each(Object.keys(PAGES) as PageKey[])(
    "renders the %s page without a missing widget",
    (key) => {
      renderForm(key)
      expect(screen.getAllByRole("region").length).toBeGreaterThan(0)
    }
  )

  it("renders the home template's sections and values", async () => {
    renderForm("home")
    for (const name of [
      "Hero",
      "Services section",
      "Team section",
      "Blog section",
    ])
      expect(screen.getByRole("region", { name })).toBeInTheDocument()
    const hero = screen.getByRole("region", { name: "Hero" })
    expect(within(hero).getByRole("textbox", { name: "Heading" })).toHaveValue(
      "Security Partners Ltd."
    )
    expect(
      within(hero).getByRole("button", {
        name: "Change image: Background image",
      })
    ).toBeInTheDocument()
    expect(
      within(hero).getByRole("group", { name: "Primary button" })
    ).toBeInTheDocument()
  })

  it("emits the edited value", async () => {
    const user = userEvent.setup()
    const { onChange } = renderForm("home")
    const hero = screen.getByRole("region", { name: "Hero" })
    const heading = within(hero).getByRole("textbox", { name: "Heading" })
    await user.clear(heading)
    await user.type(heading, "Watching Over You")
    expect(lastValue(onChange).hero.heading).toBe("Watching Over You")
  })

  it("adds, removes and reorders list items with the keyboard", async () => {
    const user = userEvent.setup()
    const { onChange } = renderForm("home")
    const stats = screen.getByRole("group", { name: "Stats" })
    const labels = () => lastValue(onChange).hero.stats.map((s) => s.label)

    within(stats).getByRole("button", { name: "Move Stat 1 down" }).focus()
    await user.keyboard("{Enter}")
    expect(labels()).toEqual([
      "Operations team",
      "Years in business",
      "Coverage across Ireland",
    ])
    await waitFor(() =>
      expect(document.activeElement).toHaveAccessibleName("Move Stat 2 down")
    )
    expect(
      within(stats).getByRole("listitem", { name: "Stat 2" })
    ).toHaveTextContent("Years in business")

    await user.click(within(stats).getByRole("button", { name: "Add stat" }))
    expect(lastValue(onChange).hero.stats).toHaveLength(4)
    expect(lastValue(onChange).hero.stats[3]).toEqual({ value: "", label: "" })

    await user.click(
      within(stats).getByRole("button", { name: "Remove Stat 4" })
    )
    expect(lastValue(onChange).hero.stats).toHaveLength(3)
    expect(
      within(stats).getByRole("button", { name: "Move Stat 1 up" })
    ).toBeDisabled()
    expect(
      within(stats).getByRole("button", { name: "Move Stat 3 down" })
    ).toBeDisabled()
  })

  it("does not allow removing below the schema minimum", async () => {
    renderForm("about")
    const values = screen.getByRole("group", { name: "Values" })
    const items = within(values).getAllByRole("listitem")
    expect(items.length).toBeGreaterThan(0)
    if (items.length === 1)
      expect(
        within(values).getByRole("button", { name: "Remove Value 1" })
      ).toBeDisabled()
  })

  it("counts characters in a textarea", async () => {
    const user = userEvent.setup()
    renderForm("home")
    const intro = screen.getByRole("textbox", { name: "Introduction" })
    const length = (intro as HTMLTextAreaElement).value.length
    expect(screen.getByText(`${length} / 5000`)).toBeInTheDocument()
    await user.type(intro, "!")
    expect(screen.getByText(`${length + 1} / 5000`)).toBeInTheDocument()
    expect(intro).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining("count")
    )
  })

  it("maps Zod errors to fields (client and server)", async () => {
    const user = userEvent.setup()
    renderForm("home", {
      errors: { "hero.tagline": ["Keep it under 40 characters"] },
    })
    expect(
      await screen.findByText("Keep it under 40 characters")
    ).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Tagline" })).toHaveAttribute(
      "aria-invalid",
      "true"
    )

    const hero = screen.getByRole("region", { name: "Hero" })
    const heading = within(hero).getByRole("textbox", { name: "Heading" })
    await user.clear(heading)
    await act(async () => heading.blur())
    await waitFor(() => expect(heading).toHaveAttribute("aria-invalid", "true"))
    expect(heading).toHaveAccessibleDescription(
      expect.stringContaining("Required")
    )
  })
})

describe("SchemaForm ledger rules", () => {
  it("rejects unknown placeholders and unsafe link destinations", async () => {
    const user = userEvent.setup()
    renderForm("home")
    const cta = screen.getByRole("group", { name: "Secondary button" })
    const href = within(cta).getByRole("textbox", { name: "Link to" })
    await user.clear(href)
    await user.type(href, "{{phoneHref}")
    await act(async () => href.blur())
    await waitFor(() => expect(href).toHaveAttribute("aria-invalid", "true"))
    expect(href).toHaveAccessibleDescription(
      expect.stringContaining("{phoneHref}")
    )

    await user.clear(href)
    await user.type(href, "javascript:alert(1)")
    await waitFor(() =>
      expect(href).toHaveAccessibleDescription(expect.stringContaining("Use"))
    )

    await user.clear(href)
    await user.type(href, "{{officeHref}")
    await waitFor(() => expect(href).toHaveAttribute("aria-invalid", "false"))
  })

  it("keeps a count-up stat's text in step with its number and suffix", async () => {
    const user = userEvent.setup()
    const { onChange } = renderForm("home")
    const stat = within(screen.getByRole("group", { name: "Stats" })).getByRole(
      "listitem",
      { name: "Stat 1" }
    )
    const value = within(stat).getByRole("textbox", { name: "Value" })
    expect(value).toHaveValue("18+")
    expect(value).toHaveAttribute("readonly")

    const count = within(stat).getByRole("spinbutton", {
      name: /Count-up number/,
    })
    await user.clear(count)
    await user.type(count, "20")
    await waitFor(() =>
      expect(lastValue(onChange).hero.stats[0].value).toBe("20+")
    )
    expect(value).toHaveValue("20+")

    const suffix = within(stat).getByRole("textbox", {
      name: /Suffix after the number/,
    })
    await user.clear(suffix)
    await waitFor(() =>
      expect(lastValue(onChange).hero.stats[0].value).toBe("20")
    )
    // A cleared optional stays cleared (not the loaded "+") and is omitted.
    expect(suffix).toHaveValue("")
    expect(lastValue(onChange).hero.stats[0]).not.toHaveProperty("suffix")

    // Without a count the text is free again.
    await user.clear(count)
    expect(count).toHaveValue(null)
    expect(lastValue(onChange).hero.stats[0]).not.toHaveProperty("count")
    expect(value).not.toHaveAttribute("readonly")
    await user.clear(value)
    await user.type(value, "Many")
    expect(lastValue(onChange).hero.stats[0].value).toBe("Many")
  })

  it("shows each moved item's own optional values", async () => {
    const user = userEvent.setup()
    renderForm("home")
    const stats = screen.getByRole("group", { name: "Stats" })
    await user.click(
      within(stats).getByRole("button", { name: "Move Stat 1 down" })
    )
    const first = within(stats).getByRole("listitem", { name: "Stat 1" })
    expect(within(first).getByRole("textbox", { name: "Value" })).toHaveValue(
      "24/7"
    )
    // "24/7" has no count; the loaded value at index 0 (18) must not leak in.
    expect(
      within(first).getByRole("spinbutton", { name: /Count-up number/ })
    ).toHaveValue(null)
    expect(
      within(first).getByRole("textbox", { name: /Suffix after the number/ })
    ).toHaveValue("")
  })
})

describe("formTabs", () => {
  it("does not reuse a group's id for the shared General tab", () => {
    const schema = z.object({
      title: z.string(),
      slug: z.string(),
      general: z.object({ note: z.string() }),
    })
    const tabs = formTabs(schema, { fields: {} })
    const ids = tabs.map((tab) => tab.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(tabs.find((tab) => tab.label === "General")?.keys).toEqual([
      "title",
      "slug",
    ])
    expect(tabs.find((tab) => tab.keys[0] === "general")?.id).toBe("general")
  })
})

describe("SchemaForm choice widgets (shadcn Select / RadioGroup / Checkbox)", () => {
  function renderChoices<S extends z.ZodObject>(
    schema: S,
    value: z.input<S>,
    meta: EditorMeta,
    errors?: Record<string, string[]>
  ) {
    const onChange = vi.fn()
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <SchemaForm
          schema={schema}
          meta={meta}
          value={value}
          onChange={onChange}
          errors={errors}
        />
      </QueryClientProvider>
    )
    return {
      onChange,
      last: () => onChange.mock.calls.at(-1)![0] as Record<string, unknown>,
    }
  }

  const kindSchema = z.object({ kind: z.enum(["a", "b", "c"]) })
  const kindMeta: EditorMeta = {
    fields: {
      kind: {
        widget: "select",
        options: [
          { value: "a", label: "Alpha" },
          { value: "b", label: "Beta" },
          { value: "c", label: "Gamma" },
        ],
      },
    },
  }

  it("select: a labelled combobox picked by keyboard, value reaches RHF", async () => {
    const user = userEvent.setup()
    const { last } = renderChoices(kindSchema, { kind: "a" }, kindMeta)
    const box = screen.getByRole("combobox", { name: "Kind" })
    expect(box).toHaveTextContent("Alpha")
    expect(box).toHaveAttribute("aria-required", "true")
    await user.click(box)
    const alpha = await screen.findByRole("option", { name: "Alpha" })
    await waitFor(() => expect(alpha).toHaveAttribute("data-highlighted"))
    await user.keyboard("{ArrowDown}{Enter}")
    await waitFor(() => expect(last().kind).toBe("b"))
    expect(box).toHaveTextContent("Beta")
  })

  it("select: shows a server error on the combobox", async () => {
    renderChoices(kindSchema, { kind: "a" }, kindMeta, {
      kind: ["Pick another kind"],
    })
    const box = screen.getByRole("combobox", { name: "Kind" })
    await waitFor(() => expect(box).toHaveAttribute("aria-invalid", "true"))
    expect(box).toHaveAccessibleDescription(
      expect.stringContaining("Pick another kind")
    )
  })

  const sizeMeta: EditorMeta = {
    fields: {
      size: {
        widget: "radio",
        help: "How big the card is.",
        options: [
          { value: "s", label: "Small" },
          { value: "m", label: "Medium" },
          { value: "l", label: "Large" },
        ],
      },
    },
  }

  it("radio: a legend-labelled radio group, arrow keys select", async () => {
    const user = userEvent.setup()
    const { last } = renderChoices(
      z.object({ size: z.enum(["s", "m", "l"]) }),
      { size: "s" },
      sizeMeta
    )
    const fieldset = screen.getByRole("group", { name: "Size" })
    expect(fieldset.tagName).toBe("FIELDSET")
    const group = within(fieldset).getByRole("radiogroup", { name: "Size" })
    expect(group).toHaveAccessibleDescription("How big the card is.")
    const small = within(group).getByRole("radio", { name: "Small" })
    expect(small).toHaveAttribute("aria-checked", "true")
    small.focus()
    await user.keyboard("{ArrowDown}")
    const medium = within(group).getByRole("radio", { name: "Medium" })
    expect(medium).toHaveFocus()
    expect(medium).toHaveAttribute("aria-checked", "true")
    await waitFor(() => expect(last().size).toBe("m"))
  })

  it("radio: more than four options falls back to a Select", () => {
    renderChoices(
      z.object({ size: z.enum(["xs", "s", "m", "l", "xl"]) }),
      { size: "m" },
      { fields: { size: { widget: "radio" } } }
    )
    expect(screen.getByRole("combobox", { name: "Size" })).toHaveTextContent(
      "m"
    )
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument()
  })

  it("checkboxes: a multi-select of roles is a legend-labelled checkbox group", async () => {
    const user = userEvent.setup()
    const { last } = renderChoices(
      z.object({ roles: z.array(z.enum(["admin", "editor", "viewer"])) }),
      { roles: [] },
      {
        fields: {
          roles: {
            label: "Allowed roles",
            options: [
              { value: "admin", label: "Admin" },
              { value: "editor", label: "Editor" },
              { value: "viewer", label: "Viewer" },
            ],
          },
        },
      }
    )
    const fieldset = screen.getByRole("group", { name: "Allowed roles" })
    expect(fieldset.tagName).toBe("FIELDSET")
    await user.click(within(fieldset).getByRole("checkbox", { name: "Viewer" }))
    within(fieldset).getByRole("checkbox", { name: "Admin" }).focus()
    await user.keyboard(" ")
    // Stored in option order, whatever the click order.
    await waitFor(() => expect(last().roles).toEqual(["admin", "viewer"]))
    expect(
      within(fieldset).getByRole("checkbox", { name: "Editor" })
    ).toHaveAttribute("aria-checked", "false")
    await user.click(within(fieldset).getByRole("checkbox", { name: "Admin" }))
    await waitFor(() => expect(last().roles).toEqual(["viewer"]))
  })

  it("checkboxes: the group carries the help text, not every box", () => {
    renderChoices(
      z.object({ roles: z.array(z.enum(["admin", "editor"])) }),
      { roles: [] },
      { fields: { roles: { label: "Roles", help: "Pick at least one." } } }
    )
    const fieldset = screen.getByRole("group", { name: "Roles" })
    expect(fieldset).toHaveAccessibleDescription("Pick at least one.")
    for (const box of within(fieldset).getAllByRole("checkbox"))
      expect(box).not.toHaveAttribute("aria-describedby")
  })
})
