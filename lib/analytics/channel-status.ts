import type { TrackingSettings } from "@/lib/schemas/settings/tracking"

export type Channel = "gtm" | "ga4" | "meta"
export type ChannelStatus = "off" | "ready" | "missing-id" | "needs-banner"

export const CHANNELS: readonly Channel[] = ["gtm", "ga4", "meta"]

const FIELDS = {
  gtm: { enabled: "gtmEnabled", id: "gtmId" },
  ga4: { enabled: "ga4Enabled", id: "ga4Id" },
  meta: { enabled: "metaEnabled", id: "metaPixelId" },
} as const satisfies Record<
  Channel,
  { enabled: keyof TrackingSettings; id: keyof TrackingSettings }
>

/** Where one channel stands: its switch, its ID, then the master switch (banner). */
export function channelStatus(
  t: TrackingSettings,
  channel: Channel
): ChannelStatus {
  const { enabled, id } = FIELDS[channel]
  if (!t[enabled]) return "off"
  if (!t[id]) return "missing-id"
  if (!t.enabled) return "needs-banner"
  return "ready"
}

export const CHANNEL_LABELS: Record<Channel, string> = {
  gtm: "Google Tag Manager",
  ga4: "Google Analytics 4",
  meta: "Meta Pixel",
}

export const STATUS_TEXT: Record<ChannelStatus, string> = {
  off: "Off",
  ready: "Ready",
  "missing-id": "Add the ID",
  "needs-banner": "Turn on tracking to show the consent banner",
}
