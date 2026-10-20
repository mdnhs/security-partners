"use client"

import { useId } from "react"

import { buildAdminTokens } from "@/lib/theme/admin"
import { toHex } from "@/lib/theme/color"
import { PRESET_IDS, PRESETS, type PresetId } from "@/lib/theme/presets"
import { AdminTheme } from "@/lib/theme/schema"
import { presetSiteTheme, resolveSiteTokens } from "@/lib/theme/site"
import { cn } from "@/lib/utils"

// Three swatches per preset: the colours a reader notices first.
function swatches(scope: "site" | "admin", id: PresetId): string[] {
  if (scope === "site") {
    const t = resolveSiteTokens(presetSiteTheme(id))
    return [t["brand-green"], t["brand-navy"], t["brand-mint"]].map(toHex)
  }
  const t = buildAdminTokens(AdminTheme.parse({ preset: id }), "light")
  return [t.primary, t.background, t.accent].map(toHex)
}

const SWATCHES = {
  site: Object.fromEntries(PRESET_IDS.map((id) => [id, swatches("site", id)])),
  admin: Object.fromEntries(
    PRESET_IDS.map((id) => [id, swatches("admin", id)])
  ),
} as Record<"site" | "admin", Record<PresetId, string[]>>

export function PresetGallery({
  value,
  onChange,
  scope,
  label,
  disabled,
}: {
  value: PresetId
  onChange(p: PresetId): void
  scope: "site" | "admin"
  label: string
  disabled?: boolean
}) {
  const labelId = useId()
  return (
    <div className="flex flex-col gap-2">
      <p id={labelId} className="text-sm font-medium">
        {label}
      </p>
      <div
        role="group"
        aria-labelledby={labelId}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"
      >
        {PRESET_IDS.map((id) => {
          const pressed = value === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={pressed}
              disabled={disabled}
              onClick={() => onChange(id)}
              className={cn(
                "flex min-h-11 flex-col gap-2 rounded-xl border bg-card p-3 text-left text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60",
                pressed
                  ? "border-primary ring-2 ring-primary"
                  : "enabled:hover:bg-muted"
              )}
            >
              <span aria-hidden className="flex">
                {SWATCHES[scope][id].map((hex, i) => (
                  <span
                    key={i}
                    data-swatch
                    className="-ml-1 size-6 rounded-full border border-foreground/15 first:ml-0"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </span>
              {PRESETS[id].label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
