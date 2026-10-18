import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { makeQueryClient } from "@/components/admin/providers"
import { SchemaForm } from "@/components/admin/schema-form/schema-form"
import { growthMetaFor } from "@/components/admin/seo/growth-meta"
import { trackingSettings } from "@/lib/schemas/settings/tracking"

// Final review I1: tag IDs are owner-only; others see them read-only with
// the reason, and keep the enable toggle.
function renderTracking(canEditTrackingTags: boolean) {
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <SchemaForm
        schema={trackingSettings}
        meta={growthMetaFor("tracking", { canEditTrackingTags })}
        value={{
          enabled: false,
          gtmId: "GTM-ABC1",
          ga4Id: null,
          metaPixelId: null,
        }}
        onChange={vi.fn()}
      />
    </QueryClientProvider>
  )
}

const TAG_LABELS = [
  "Google Tag Manager ID",
  "Google Analytics 4 ID",
  "Meta Pixel ID",
]

describe("tracking tag ID fields (final review I1)", () => {
  it("are read-only with an explanation for non-owners", () => {
    renderTracking(false)
    for (const name of TAG_LABELS) {
      const input = screen.getByRole("textbox", {
        name: new RegExp(`^${name}`),
      })
      expect(input).toHaveAttribute("readonly")
      expect(input).toHaveAccessibleDescription(/only an owner/i)
    }
    expect(screen.getByRole("switch", { name: "Load tracking" })).toBeEnabled()
  })

  it("are editable for owners", () => {
    renderTracking(true)
    for (const name of TAG_LABELS)
      expect(
        screen.getByRole("textbox", { name: new RegExp(`^${name}`) })
      ).not.toHaveAttribute("readonly")
  })
})
