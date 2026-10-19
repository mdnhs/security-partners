import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { OptionSelect } from "@/components/admin/option-select"

const OPTIONS = [
  { value: "", label: "Unassigned" },
  { value: "u1", label: "Ada" },
]

// A8 axe gate: Base UI marks "" as a placeholder, and the muted placeholder
// colour on the dark trigger is 4.4:1. "" is a real option here ("Unassigned",
// "— None —"), so its label keeps the ordinary text colour.
describe("OptionSelect", () => {
  it("shows a chosen '' option in the ordinary text colour", () => {
    render(
      <OptionSelect
        aria-label="Assigned to"
        value=""
        options={OPTIONS}
        onChange={() => {}}
      />
    )
    const trigger = screen.getByRole("combobox", { name: "Assigned to" })
    expect(trigger).toHaveTextContent("Unassigned")
    expect(trigger).toHaveClass("data-placeholder:text-foreground")
  })

  it("the dark trigger tint replaces the primitive's (placeholder contrast)", () => {
    render(
      <OptionSelect
        aria-label="Category"
        value=""
        options={[{ value: "c1", label: "News" }]}
        placeholder="Choose…"
        onChange={() => {}}
      />
    )
    const trigger = screen.getByRole("combobox", { name: "Category" })
    expect(trigger).toHaveTextContent("Choose…")
    expect(trigger).toHaveClass("dark:bg-input/20")
    expect(trigger).not.toHaveClass("dark:bg-input/30")
  })

  it("keeps the muted placeholder for a value with no option yet", () => {
    render(
      <OptionSelect
        aria-label="Assigned to"
        value="u9"
        options={OPTIONS}
        onChange={() => {}}
      />
    )
    const trigger = screen.getByRole("combobox", { name: "Assigned to" })
    expect(trigger).toHaveTextContent("…")
    expect(trigger).not.toHaveClass("data-placeholder:text-foreground")
  })
})
