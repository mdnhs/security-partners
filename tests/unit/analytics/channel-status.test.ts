import { describe, expect, it } from "vitest"

import {
  CHANNEL_LABELS,
  CHANNELS,
  type Channel,
  type ChannelStatus,
  channelStatus,
  STATUS_TEXT,
} from "@/lib/analytics/channel-status"
import type { TrackingSettings } from "@/lib/schemas/settings/tracking"

const OFF: TrackingSettings = {
  enabled: false,
  gtmEnabled: false,
  gtmId: null,
  ga4Enabled: false,
  ga4Id: null,
  metaEnabled: false,
  metaPixelId: null,
}

const SWITCH = { gtm: "gtmEnabled", ga4: "ga4Enabled", meta: "metaEnabled" }
const ID = {
  gtm: ["gtmId", "GTM-ABC1"],
  ga4: ["ga4Id", "G-ABC1"],
  meta: ["metaPixelId", "1234567"],
} as const

describe("channelStatus", () => {
  const rows: [boolean, boolean, boolean, ChannelStatus][] = [
    // [master, channel switch, has ID, status]
    [false, false, false, "off"],
    [false, false, true, "off"],
    [true, false, true, "off"],
    [true, true, false, "missing-id"],
    [false, true, false, "missing-id"],
    [false, true, true, "needs-banner"],
    [true, true, true, "ready"],
  ]
  for (const channel of CHANNELS)
    for (const [enabled, on, hasId, expected] of rows)
      it(`${channel}: enabled=${enabled} switch=${on} id=${hasId} → ${expected}`, () => {
        const [idKey, id] = ID[channel]
        const t = {
          ...OFF,
          enabled,
          [SWITCH[channel]]: on,
          [idKey]: hasId ? id : null,
        } as TrackingSettings
        expect(channelStatus(t, channel)).toBe(expected)
      })

  it("only looks at its own channel", () => {
    const t: TrackingSettings = {
      ...OFF,
      enabled: true,
      gtmEnabled: true,
      gtmId: "GTM-ABC1",
    }
    expect(channelStatus(t, "gtm")).toBe("ready")
    expect(channelStatus(t, "ga4")).toBe("off")
    expect(channelStatus(t, "meta")).toBe("off")
  })
})

describe("labels", () => {
  it("names every channel and status", () => {
    expect(CHANNELS).toEqual(["gtm", "ga4", "meta"] satisfies Channel[])
    expect(CHANNEL_LABELS).toEqual({
      gtm: "Google Tag Manager",
      ga4: "Google Analytics 4",
      meta: "Meta Pixel",
    })
    expect(STATUS_TEXT).toEqual({
      off: "Off",
      ready: "Ready",
      "missing-id": "Add the ID",
      "needs-banner": "Turn on tracking to show the consent banner",
    })
  })
})
