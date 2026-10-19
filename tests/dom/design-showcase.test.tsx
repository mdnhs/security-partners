import { render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ href, ...props }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props} />
  ),
}))

import { Showcase } from "@/components/admin/design/showcase"

afterEach(() => {
  vi.unstubAllGlobals()
})

// MK-parity A7: /admin/design renders every admin component on fixed
// sample data, in the brief's order, without touching the API.
describe("design system showcase", () => {
  it("renders the sections in order on sample data, with no API calls", () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("the gallery must not fetch")
    })
    vi.stubGlobal("fetch", fetchSpy)
    render(<Showcase />)

    expect(
      screen.getByRole("heading", { level: 1, name: "Design system" })
    ).toBeVisible()
    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent)
    ).toEqual([
      "KPI cards",
      "Dashboard cards",
      "Status pills",
      "Form controls",
      "Table",
      "Empty and loading states",
      "Breadcrumb and item list",
    ])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("shows the page header actions and a hero plus three default KPIs", () => {
    render(<Showcase />)
    const header = screen.getByRole("banner")
    expect(
      within(header).getByRole("button", { name: "New service" })
    ).toBeVisible()
    expect(
      within(header).getByRole("button", { name: "View site" })
    ).toBeVisible()
    const kpis = document.querySelectorAll("article[data-variant]")
    expect([...kpis].map((kpi) => kpi.getAttribute("data-variant"))).toEqual([
      "hero",
      "default",
      "default",
      "default",
    ])
  })

  it("shows the dashboard cards: two-series chart, Next up, activity, gauge", () => {
    render(<Showcase />)
    for (const name of [
      "Enquiries this week",
      "Next up",
      "Team activity",
      "Content health",
    ])
      expect(screen.getByRole("heading", { level: 3, name })).toBeVisible()
    // Both series reach the screen-reader table.
    expect(
      screen.getByRole("columnheader", { name: "This week" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("columnheader", { name: "Last week" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("region", { name: "Team activity list" })
    ).toBeVisible()
  })

  it("shows a status pill in every tone", () => {
    render(<Showcase />)
    const tones = new Set(
      [
        ...document.querySelectorAll(
          '[aria-labelledby] [data-slot="status-pill"]'
        ),
      ].map((pill) => pill.getAttribute("data-tone"))
    )
    expect([...tones].sort()).toEqual([
      "danger",
      "info",
      "neutral",
      "success",
      "warning",
    ])
  })

  it("labels every form control", () => {
    render(<Showcase />)
    expect(screen.getByRole("textbox", { name: "Service name" })).toBeVisible()
    expect(screen.getByRole("textbox", { name: "Summary" })).toBeVisible()
    expect(screen.getByRole("combobox", { name: "Region" })).toHaveTextContent(
      "Dublin"
    )
    const group = screen.getByRole("radiogroup", { name: "Response time" })
    expect(within(group).getAllByRole("radio")).toHaveLength(3)
    expect(
      screen.getByRole("checkbox", { name: "Show on the home page" })
    ).toBeVisible()
    expect(
      screen.getByRole("switch", { name: "Accepting enquiries" })
    ).toBeVisible()
    expect(screen.getByRole("tablist", { name: "Sample tabs" })).toBeVisible()
  })

  it("shows the table, empty and skeleton states, breadcrumb and item list", () => {
    render(<Showcase />)
    expect(
      screen.getByRole("table", { name: "Recent enquiries" })
    ).toBeVisible()
    expect(screen.getByText("No enquiries yet")).toBeVisible()
    expect(
      document.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
    const crumbs = screen.getByRole("navigation", { name: "Sample breadcrumb" })
    expect(within(crumbs).getByText("Alarm Responses")).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(screen.getByRole("list", { name: "Sample items" })).toBeVisible()
  })
})
