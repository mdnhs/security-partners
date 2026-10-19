import { render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/settings/leads",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

import { makeQueryClient } from "@/components/admin/providers"
import { SettingsEditor } from "@/components/admin/settings/settings-editor"
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
      <SettingsEditor settingsKey="leads" />
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

  it("the shell's rail lists the settings pages with the current one marked", async () => {
    renderAs(["admin"])
    const nav = screen.getByRole("navigation", { name: "Site settings" })
    const links = within(nav).getAllByRole("link")
    // No overview tab: /admin/settings redirects to the first key.
    expect(links[0]).toHaveTextContent("Identity")
    expect(links[0]).toHaveAttribute("href", "/admin/settings/site")
    // 11 settings keys, then AI assistant and Integrations (owner/admin).
    expect(links).toHaveLength(13)
    expect(links[11]).toHaveTextContent("AI assistant")
    expect(links[12]).toHaveTextContent("Integrations")
    expect(
      within(nav).getByRole("link", { name: "Enquiries" })
    ).toHaveAttribute("aria-current", "page")
    expect(
      within(nav).getByRole("link", { name: "Identity" })
    ).not.toHaveAttribute("aria-current")
    // Inside the rail there is no back link to an overview.
    expect(screen.queryByRole("link", { name: "All settings" })).toBeNull()
    // MK: the page sits on the panel beside the rail; the editor bar is a
    // card of its own (no white content card around the editor).
    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "Enquiries",
    })
    const bar = heading.closest('[data-slot="editor-bar"]')
    expect(bar).toHaveClass("bg-card", "rounded-card", "border")
    expect(bar).not.toHaveClass("rounded-t-card", "-mx-(--card-pad,0px)")
    expect(bar).not.toHaveClass("backdrop-blur")
    // Sticky itself; offsets come from main's padding variable, and the
    // strip above it (admin.css) is --strip-h tall.
    expect(bar).toHaveClass(
      "sticky",
      "lg:top-0",
      "lg:[--strip-h:var(--main-pad)]"
    )
    const content = bar?.closest('[data-slot="section-content"]')
    expect(content).not.toBeNull()
    expect(content).not.toHaveClass("bg-card")
    expect(bar?.closest('[data-slot="section-tabs-content"]')).toBeNull()
    // MK copy under the title; History stays in the bar.
    expect(
      within(bar as HTMLElement).getByText(
        "Changes stay in a draft until you publish."
      )
    ).toBeVisible()
    expect(
      within(bar as HTMLElement).getByRole("button", { name: "History" })
    ).toBeInTheDocument()
    expect(
      await screen.findByRole("heading", { level: 1, name: "Enquiries" })
    ).toBeVisible()
  })

  it("lists only the keys the user may read", () => {
    renderAs(["author"])
    expect(
      screen.queryByRole("navigation", { name: "Site settings" })
    ).toBeNull()
  })
})
