import { render, screen, within } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"

import { Gauge } from "@/components/admin/kit/gauge"

beforeAll(() => {
  // Reduced motion, so arcs draw at once; jsdom lays nothing out.
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: true,
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }) as unknown as MediaQueryList
  )
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    DOMRect.fromRect({ width: 640, height: 320 })
  )
})

describe("Gauge (kit)", () => {
  it("shows the headline share, a legend and a screen-reader table", () => {
    render(
      <Gauge
        title="SEO health"
        centerLabel="Passing"
        headlineKey="passed"
        parts={[
          { key: "passed", label: "Passing checks", value: 41, tone: "solid" },
          { key: "failed", label: "Needs work", value: 59, tone: "hatched" },
        ]}
      />
    )
    expect(screen.getByText("41%")).toBeInTheDocument()
    expect(screen.getByText("Passing")).toBeInTheDocument()
    const table = screen.getByRole("table", { name: "SEO health" })
    expect(
      within(table)
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.textContent)
    ).toEqual(["Passing checks41", "Needs work59"])
    // A visually hidden table has nothing to scroll: no scroll container
    // (axe scrollable-region-focusable).
    expect(table.closest('[data-slot="table-container"]')).toBeNull()
  })

  it("an empty gauge shows a dash, never NaN", () => {
    render(
      <Gauge
        title="Empty"
        centerLabel="Passing"
        parts={[{ key: "passed", label: "Passing", value: 0, tone: "solid" }]}
      />
    )
    expect(screen.getByText("—")).toBeInTheDocument()
  })
})
