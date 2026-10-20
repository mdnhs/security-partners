"use client"

import { CircleCheck, CircleDashed, CircleAlert, Send } from "lucide-react"

import { DashboardCard } from "@/components/admin/kit/dashboard-card"
import { StatusPill, type StatusTone } from "@/components/admin/kit/status-pill"
import { Button } from "@/components/ui/button"
import {
  CHANNEL_LABELS,
  CHANNELS,
  type ChannelStatus,
  channelStatus,
  STATUS_TEXT,
} from "@/lib/analytics/channel-status"
import { TRACKING_TEST_PARAM } from "@/lib/analytics/loaders"
import type { TrackingSettings } from "@/lib/schemas/settings/tracking"

const STATUS_LOOK: Record<
  ChannelStatus,
  { tone: StatusTone; Icon: typeof CircleCheck }
> = {
  off: { tone: "neutral", Icon: CircleDashed },
  ready: { tone: "success", Icon: CircleCheck },
  "missing-id": { tone: "warning", Icon: CircleAlert },
  "needs-banner": { tone: "warning", Icon: CircleAlert },
}

const text = (value: unknown) =>
  (typeof value === "string" && value.trim()) || null

/**
 * The editor's unsaved draft read loosely (it may be mid-edit and invalid):
 * anything missing or not of the right type counts as off / no ID.
 */
export function trackingDraft(draft: unknown): TrackingSettings {
  const d = (
    typeof draft === "object" && draft !== null ? draft : {}
  ) as Record<string, unknown>
  return {
    enabled: d.enabled === true,
    gtmEnabled: d.gtmEnabled === true,
    gtmId: text(d.gtmId),
    ga4Enabled: d.ga4Enabled === true,
    ga4Id: text(d.ga4Id),
    metaEnabled: d.metaEnabled === true,
    metaPixelId: text(d.metaPixelId),
  }
}

/** Side card on Marketing › Tracking: each channel's state and a test event. */
export function TrackingStatus({ value }: { value: TrackingSettings }) {
  const sendTestEvent = () =>
    window.open(
      `/?${TRACKING_TEST_PARAM}=${crypto.randomUUID()}`,
      "_blank",
      "noopener"
    )
  return (
    <DashboardCard title="Status" headingLevel={2}>
      <ul className="flex flex-col gap-3 text-sm">
        {CHANNELS.map((channel) => {
          const status = channelStatus(value, channel)
          const { tone, Icon } = STATUS_LOOK[status]
          return (
            <li key={channel} className="flex flex-col items-start gap-1.5">
              <span className="font-semibold">{CHANNEL_LABELS[channel]}</span>
              <StatusPill
                tone={tone}
                className="h-auto min-h-7 gap-1.5 py-1 whitespace-normal"
              >
                <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                {STATUS_TEXT[status]}
              </StatusPill>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-col items-start gap-2">
        <Button
          type="button"
          variant="outline"
          className="pointer-coarse:min-h-11"
          onClick={sendTestEvent}
        >
          <Send aria-hidden="true" />
          Send test event
        </Button>
        <p className="text-sm text-muted-foreground">
          Accept cookies in the banner on that tab, then look in GTM Preview,
          GA4 DebugView or Meta Test Events.
        </p>
        <p className="text-sm text-muted-foreground">
          GTM and GA4 need analytics consent; Meta Pixel needs marketing
          consent.
        </p>
        <p className="text-sm text-muted-foreground">
          The test uses the published settings, so publish your changes first.
        </p>
      </div>
    </DashboardCard>
  )
}
