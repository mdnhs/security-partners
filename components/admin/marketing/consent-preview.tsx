"use client"

import "./consent-preview.css"

import { type CSSProperties, useState } from "react"

import { DashboardCard } from "@/components/admin/kit/dashboard-card"
import {
  type ConsentBannerCopy,
  ConsentBannerView,
} from "@/components/consent/consent-banner-view"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { BANNER_PREVIEW_STYLE } from "@/lib/analytics/banner-preview-style"
import type { ConsentChoice } from "@/lib/analytics/consent"
import {
  type ConsentSettings,
  DEFAULT_CLOSE_LABEL,
  DEFAULT_CONSENT_VERSION,
  DEFAULT_RECONSENT_MONTHS,
} from "@/lib/schemas/settings/consent"

type View = "first" | "custom"

const NONE: ConsentChoice = { analytics: false, marketing: false }
type Category = keyof ConsentSettings["categories"]

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {}
const text = (value: unknown) => (typeof value === "string" ? value : "")
const whole = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isInteger(value) ? value : fallback

/**
 * The editor's unsaved draft read loosely (it may be mid-edit and invalid):
 * missing or odd text becomes empty, so the preview always renders.
 */
export function consentDraft(draft: unknown): ConsentSettings {
  const d = record(draft)
  const categories = record(d.categories)
  const link = record(d.policyLink)
  const category = (key: Category) => {
    const c = record(categories[key])
    return { label: text(c.label), description: text(c.description) }
  }
  return {
    title: text(d.title),
    body: text(d.body),
    acceptLabel: text(d.acceptLabel),
    rejectLabel: text(d.rejectLabel),
    customiseLabel: text(d.customiseLabel),
    saveLabel: text(d.saveLabel),
    manageLabel: text(d.manageLabel),
    closeLabel: text(d.closeLabel) || DEFAULT_CLOSE_LABEL,
    policyLink: { label: text(link.label), href: text(link.href) },
    categories: {
      necessary: category("necessary"),
      analytics: category("analytics"),
      marketing: category("marketing"),
    },
    version: whole(d.version, DEFAULT_CONSENT_VERSION),
    reconsentMonths: whole(d.reconsentMonths, DEFAULT_RECONSENT_MONTHS),
  }
}

/**
 * Side card on Marketing › Consent banner: the public banner as the draft
 * stands, on its first layer or with the categories open. The switches work;
 * nothing is stored and nothing loads. Copy is shown as typed ({placeholders}
 * are filled on the public site).
 */
export function ConsentPreview({ value }: { value: ConsentSettings }) {
  const [view, setView] = useState<View>("first")
  const [choice, setChoice] = useState<ConsentChoice>(NONE)
  const copy: ConsentBannerCopy = value
  const noop = () => {}
  return (
    <DashboardCard title="Preview" headingLevel={2}>
      <ToggleGroup
        value={[view]}
        onValueChange={(next) => {
          if (next[0]) setView(next[0] as View)
        }}
        aria-label="Banner view"
        variant="outline"
        className="[&_[data-slot=toggle-group-item]]:pointer-coarse:h-11"
      >
        <ToggleGroupItem value="first">First layer</ToggleGroupItem>
        <ToggleGroupItem value="custom">Customise</ToggleGroupItem>
      </ToggleGroup>
      <div
        data-consent-preview
        style={BANNER_PREVIEW_STYLE as CSSProperties}
        className="-mx-2 overflow-hidden rounded-xl"
      >
        <ConsentBannerView
          inline
          copy={copy}
          mode={view}
          choice={choice}
          onAccept={noop}
          onReject={noop}
          onCustomise={() => setView("custom")}
          onSave={noop}
          onToggle={(key, on) => setChoice({ ...choice, [key]: on })}
          onClose={noop}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        A preview: choices made here are not saved. Visitors who chose under an
        older consent version, or longer ago than the re-consent interval, see
        the banner again.
      </p>
    </DashboardCard>
  )
}
