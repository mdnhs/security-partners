import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/components/site-theme-style", () => ({
  SiteThemeStyle: () => null,
}))

import { DetailSkeleton } from "@/components/site-detail-skeleton"
import { SiteThemed } from "@/components/site-themed"

afterEach(cleanup)

// A child that is still waiting for its request-time data.
function Pending(): never {
  throw new Promise(() => {})
}

describe("detail page loading state", () => {
  it("shows the skeleton while the page content streams", () => {
    render(
      <SiteThemed fallback={<DetailSkeleton />}>
        <Pending />
      </SiteThemed>
    )
    expect(screen.getByRole("status", { name: "Loading page" })).toBeVisible()
  })

  it("shows nothing by default, as before", () => {
    const { container } = render(
      <SiteThemed>
        <Pending />
      </SiteThemed>
    )
    expect(container.textContent).toBe("")
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("shows the content, not the skeleton, once it is ready", () => {
    render(
      <SiteThemed fallback={<DetailSkeleton />}>
        <p>Alarm Response</p>
      </SiteThemed>
    )
    expect(screen.getByText("Alarm Response")).toBeVisible()
    expect(screen.queryByRole("status")).toBeNull()
  })
})
