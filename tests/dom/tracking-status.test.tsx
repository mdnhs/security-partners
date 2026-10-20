import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  TrackingStatus,
  trackingDraft,
} from "@/components/admin/marketing/tracking-status"

const OFF = {
  enabled: false,
  gtmEnabled: false,
  gtmId: null,
  ga4Enabled: false,
  ga4Id: null,
  metaEnabled: false,
  metaPixelId: null,
}

afterEach(() => vi.restoreAllMocks())

describe("TrackingStatus (Marketing › Tracking side panel)", () => {
  it("one row per channel, each status shown with an icon and words", () => {
    render(
      <TrackingStatus
        value={{
          ...OFF,
          gtmEnabled: true,
          ga4Enabled: true,
          ga4Id: "G-ABC1",
        }}
      />
    )
    const card = screen.getByRole("region", { name: "Status" })
    const rows = within(card).getAllByRole("listitem")
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent("Google Tag Manager")
    expect(rows[0]).toHaveTextContent("Add the ID")
    expect(rows[1]).toHaveTextContent("Google Analytics 4")
    expect(rows[1]).toHaveTextContent(
      "Turn on tracking to show the consent banner"
    )
    expect(rows[2]).toHaveTextContent("Meta Pixel")
    expect(rows[2]).toHaveTextContent("Off")
    for (const row of rows)
      expect(row.querySelector("svg[aria-hidden='true']")).not.toBeNull()
  })

  it("ready once the master switch is on", () => {
    render(
      <TrackingStatus
        value={{ ...OFF, enabled: true, metaEnabled: true, metaPixelId: "12" }}
      />
    )
    const rows = screen.getAllByRole("listitem")
    expect(rows[2]).toHaveTextContent("Ready")
  })

  it("Send test event opens the home page with a fresh test id in a new tab", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null)
    render(<TrackingStatus value={OFF} />)
    expect(
      screen.getByText(
        "Accept cookies in the banner on that tab, then look in GTM Preview, GA4 DebugView or Meta Test Events."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "GTM and GA4 need analytics consent; Meta Pixel needs marketing consent."
      )
    ).toBeInTheDocument()
    const button = screen.getByRole("button", { name: "Send test event" })
    // 44 px target on a coarse pointer (project rule, WCAG 2.5.8 is 24 px).
    expect(button).toHaveClass("pointer-coarse:min-h-11")
    await userEvent.click(button)
    expect(open).toHaveBeenCalledTimes(1)
    const [url, target] = open.mock.calls[0]!
    expect(String(url)).toMatch(
      /^\/\?sp_tracking_test=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
    expect(target).toBe("_blank")
  })
})

describe("trackingDraft (the editor's unsaved draft)", () => {
  it("reads loosely: missing or empty values count as off / no ID", () => {
    expect(trackingDraft(undefined)).toEqual(OFF)
    expect(
      trackingDraft({ enabled: true, gtmEnabled: true, gtmId: "", ga4Id: 3 })
    ).toEqual({ ...OFF, enabled: true, gtmEnabled: true })
    expect(trackingDraft({ ...OFF, metaPixelId: "99" })).toEqual({
      ...OFF,
      metaPixelId: "99",
    })
  })

  it("trims IDs the same way it tests them", () => {
    expect(trackingDraft({ gtmId: "  GTM-AB12  ", ga4Id: "   " })).toEqual({
      ...OFF,
      gtmId: "GTM-AB12",
    })
  })
})
