import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { EventsView } from "@/components/admin/marketing/events-view"
import { EVENT_CATALOGUE } from "@/lib/analytics/events"

describe("EventsView (Marketing › Event catalogue, D2.4)", () => {
  it("a table with one row per catalogue event", () => {
    render(<EventsView />)
    const table = screen.getByRole("table")
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((h) => h.textContent)
    expect(headers).toEqual(["Event", "Fires when", "Params", "GA4", "Meta"])
    const rows = within(table).getAllByRole("row").slice(1)
    expect(rows).toHaveLength(EVENT_CATALOGUE.length)
    const lead = rows.find((r) => r.textContent?.includes("lead_submitted"))!
    const cells = within(lead)
      .getAllByRole("cell")
      .map((c) => c.textContent)
    expect(cells).toEqual([
      "lead_submitted",
      "the contact form was accepted",
      "source_page",
      "generate_lead",
      "Lead",
    ])
  })

  it("an event with no Meta mapping says so in words, not just a dash", () => {
    render(<EventsView />)
    const row = screen
      .getAllByRole("row")
      .find((r) => r.textContent?.startsWith("cta_click"))!
    const meta = within(row).getAllByRole("cell").at(-1)!
    expect(meta).toHaveTextContent("—")
    expect(within(meta).getByText("None")).toBeInTheDocument()
  })

  it("explains how to set up GTM with the container file", () => {
    render(<EventsView />)
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === "P" &&
          el.textContent ===
            "To set up Google Tag Manager, import docs/gtm-container.json (ask your developer for the file)."
      )
    ).toBeInTheDocument()
  })
})
