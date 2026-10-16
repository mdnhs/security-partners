import { render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/settings/leads",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

import { makeQueryClient } from "@/components/admin/providers"
import { SettingsEditor } from "@/components/admin/settings/settings-editor"
import { SettingsTabs } from "@/components/admin/settings/settings-tabs"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { Role } from "@/lib/auth/roles"

const leads = {
  key: "leads",
  label: "Enquiries",
  description: "",
  group: "Leads",
  canEdit: false,
  draft: {
    recipients: ["info@example.ie"],
    retentionMonths: 24,
    acknowledgement: true,
  },
  published: {
    recipients: ["info@example.ie"],
    retentionMonths: 24,
    acknowledgement: true,
  },
  version: 1,
  status: "published",
  dirty: false,
  publishedAt: null,
  updatedAt: "2026-10-16T09:00:00.000Z",
  updatedBy: null,
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(leads), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    )
  )
})

function renderAs(roles: Role[]) {
  render(
    <AdminShell
      queryClient={makeQueryClient()}
      session={{
        user: {
          id: "u",
          name: "U",
          email: "u@x.test",
          title: null,
          twoFactorEnabled: true,
        },
        roles,
        impersonatedBy: null,
      }}
    >
      <SettingsTabs>
        <SettingsEditor settingsKey="leads" />
      </SettingsTabs>
    </AdminShell>
  )
}

describe("settings editor (master 4.5)", () => {
  it("is read-only for editors on the leads key (no publish, inputs disabled)", async () => {
    renderAs(["editor"])
    const field = await screen.findByRole("spinbutton", {
      name: "Keep enquiries for (months)",
    })
    expect(field).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull()
    expect(screen.queryByRole("status", { name: /^Save status/ })).toBeNull()
  })

  it("is editable for admins", async () => {
    renderAs(["admin"])
    const field = await screen.findByRole("spinbutton", {
      name: "Keep enquiries for (months)",
    })
    expect(field).toBeEnabled()
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument()
    expect(
      within(
        screen.getByRole("group", { name: "Notify these addresses" })
      ).getByRole("button", { name: "Add recipient" })
    ).toBeEnabled()
  })

  it("lists the settings keys as route tabs with the current one marked", async () => {
    renderAs(["admin"])
    const nav = screen.getByRole("navigation", { name: "Settings" })
    const links = within(nav).getAllByRole("link")
    // No overview tab: /admin/settings redirects to the first key.
    expect(links[0]).toHaveTextContent("Site")
    expect(links[0]).toHaveAttribute("href", "/admin/settings/site")
    expect(links).toHaveLength(11)
    expect(
      within(nav).getByRole("link", { name: "Enquiries" })
    ).toHaveAttribute("aria-current", "page")
    expect(within(nav).getByRole("link", { name: "Site" })).not.toHaveAttribute(
      "aria-current"
    )
    // Inside the rail there is no back link to an overview.
    expect(screen.queryByRole("link", { name: "All settings" })).toBeNull()
    // The editor bar is the opaque, sticky top of the white content card.
    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "Enquiries",
    })
    const bar = heading.closest('[data-slot="editor-bar"]')
    expect(bar).toHaveClass("bg-card", "rounded-t-card", "border-b")
    expect(bar).not.toHaveClass("backdrop-blur")
    // Sticky itself; offsets come from main's and the card's padding
    // variables, and the strip above it (admin.css) is --strip-h tall.
    expect(bar).toHaveClass(
      "sticky",
      "lg:top-0",
      "-mx-(--card-pad,0px)",
      "-mt-(--card-pad,0px)",
      "lg:[--strip-h:var(--main-pad)]"
    )
    expect(bar?.closest('[data-slot="section-tabs-content"]')).toHaveClass(
      "bg-card"
    )
    // The editor sits in the tab content (no full-bleed header bar).
    expect(
      await screen.findByRole("heading", { level: 1, name: "Enquiries" })
    ).toBeVisible()
  })

  it("lists only the keys the user may read", () => {
    renderAs(["author"])
    expect(screen.queryByRole("navigation", { name: "Settings" })).toBeNull()
  })
})
