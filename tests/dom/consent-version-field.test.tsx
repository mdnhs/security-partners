import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { makeQueryClient } from "@/components/admin/providers"
import { SchemaForm } from "@/components/admin/schema-form/schema-form"
import { growthMetaFor } from "@/components/admin/seo/growth-meta"
import { consentSettings } from "@/lib/schemas/settings/consent"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { settingsFixture } from "@/server/db/seed/fixtures/settings"

// Review D2.2 I1: the schema's .default(1) must not make the admin field
// optional — a cleared version would silently save as 1 and revive older
// consent. The field is required: blank is an error, never 1.
describe("consent version field", () => {
  it("is required and a blank value is not sent as 1", async () => {
    const onChange = vi.fn()
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <SchemaForm
          schema={consentSettings}
          meta={growthMetaFor("consent", { canEditTrackingTags: true })}
          value={{
            ...settingsFixture(fixtureMediaLookup).consent,
            version: 3,
          }}
          onChange={onChange}
        />
      </QueryClientProvider>
    )
    const input = screen.getByRole("spinbutton", { name: /^Consent version/ })
    expect(input).toHaveAttribute("aria-required", "true")
    expect(input).toHaveValue(3)
    const user = userEvent.setup()
    await user.clear(input)
    await user.tab()
    const last = onChange.mock.calls.at(-1)?.[0] as { version?: unknown }
    expect(last).toBeDefined()
    expect(last.version).not.toBe(1)
    expect(consentSettings.safeParse(last).success).toBe(false)
    expect(input).toHaveAttribute("aria-invalid", "true")
  })
})
