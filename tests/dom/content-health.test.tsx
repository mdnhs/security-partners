import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ContentHealthCard } from "@/components/admin/dashboard/content-health"

describe("dashboard Content health card (D3.5)", () => {
  it("draws complete / needs work / missing as a gauge with a link to SEO", () => {
    render(
      <ContentHealthCard health={{ complete: 6, needsWork: 1, missing: 1 }} />
    )
    const card = screen.getByRole("region", { name: "Content health" })
    // 6 of 8 published records pass every check.
    expect(card).toHaveTextContent("75%")
    const table = within(card).getByRole("table", { name: "Content health" })
    expect(table).toHaveTextContent("Missing description or alt text")
    expect(
      within(card).getByRole("link", { name: "Open SEO" })
    ).toHaveAttribute("href", "/admin/seo")
  })

  it("is absent when the API sends null (no seo:read)", () => {
    render(<ContentHealthCard health={null} />)
    expect(screen.queryByRole("region", { name: "Content health" })).toBeNull()
  })

  it("an empty site reads a dash, never NaN", () => {
    render(
      <ContentHealthCard health={{ complete: 0, needsWork: 0, missing: 0 }} />
    )
    const card = screen.getByRole("region", { name: "Content health" })
    expect(card).not.toHaveTextContent(/NaN|∞/)
  })
})
