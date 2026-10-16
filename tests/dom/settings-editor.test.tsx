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
    expect(links[0]).toHaveTextContent("Overview")
    expect(links[0]).toHaveAttribute("href", "/admin/settings")
    expect(links).toHaveLength(12)
    expect(
      within(nav).getByRole("link", { name: "Enquiries" })
    ).toHaveAttribute("aria-current", "page")
    expect(
      within(nav).getByRole("link", { name: "Overview" })
    ).not.toHaveAttribute("aria-current")
    // The editor sits in the tab content (no full-bleed header bar).
    expect(
      await screen.findByRole("heading", { level: 1, name: "Enquiries" })
    ).toBeVisible()
  })
})
