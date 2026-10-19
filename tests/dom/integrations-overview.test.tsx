import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ href, ...props }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props} />
  ),
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/settings/integrations/smtp",
}))

import { IntegrationsOverview } from "@/components/admin/integrations/integrations-overview"
import { makeQueryClient } from "@/components/admin/providers"
import {
  type AdminSession,
  AdminSessionProvider,
} from "@/components/admin/session-provider"
import { SettingsTabs } from "@/components/admin/settings/settings-tabs"
import type { Role } from "@/lib/auth/roles"

const item = (
  slug: string,
  label: string,
  configured: boolean
): Record<string, unknown> => ({
  key: `integrations.${slug}`,
  slug,
  label,
  description: `${label} description.`,
  configured,
  version: configured ? 2 : 0,
  values: {},
  secrets: {},
  updatedAt: configured ? "2026-10-16T10:00:00.000Z" : null,
  updatedBy: configured ? { id: "u1", name: "Olive Owner" } : null,
})

let respond: () => Response
beforeEach(() => {
  respond = () =>
    new Response(
      JSON.stringify({
        items: [
          item("smtp", "Email (SMTP)", true),
          item("r2", "Media storage (Cloudflare R2)", false),
          item("ai", "AI assistant", false),
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => respond())
  )
})

function session(roles: Role[]): AdminSession {
  return {
    user: {
      id: "u1",
      name: "Olive Owner",
      email: "o@example.test",
      title: null,
      twoFactorEnabled: true,
    },
    roles,
    impersonatedBy: null,
  }
}

function renderWith(roles: Role[], ui: React.ReactNode) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <AdminSessionProvider value={session(roles)}>{ui}</AdminSessionProvider>
    </QueryClientProvider>
  )
}

describe("Integrations overview", () => {
  it("one link per integration with its state", async () => {
    renderWith(["owner"], <IntegrationsOverview />)
    const smtp = await screen.findByRole("link", { name: /Email \(SMTP\)/ })
    expect(smtp).toHaveAttribute("href", "/admin/settings/integrations/smtp")
    expect(within(smtp).getByText("Connected")).toBeVisible()
    expect(within(smtp).getByText(/by Olive Owner/)).toBeVisible()
    const r2 = screen.getByRole("link", { name: /Media storage/ })
    expect(r2).toHaveAttribute("href", "/admin/settings/integrations/r2")
    expect(within(r2).getByText("Not set up")).toBeVisible()
    // MK §5.1: the AI assistant has its own Site settings page.
    expect(screen.getByRole("link", { name: /AI assistant/ })).toHaveAttribute(
      "href",
      "/admin/settings/ai-assistant"
    )
  })

  it("a failed load says so and offers Try again", async () => {
    respond = () =>
      new Response(
        JSON.stringify({
          error: { code: "FORBIDDEN", message: "Not allowed", requestId: "r" },
        }),
        { status: 403, headers: { "content-type": "application/json" } }
      )
    renderWith(["owner"], <IntegrationsOverview />)
    const alert = await screen.findByRole("alert")
    expect(
      within(alert).getByRole("button", { name: "Try again" })
    ).toBeVisible()
  })
})

describe("Settings tabs: Integrations", () => {
  it("owners and admins get the Integrations tab (current on its pages)", () => {
    renderWith(["admin"], <SettingsTabs>content</SettingsTabs>)
    const nav = screen.getByRole("navigation", { name: "Settings" })
    const link = within(nav).getByRole("link", { name: "Integrations" })
    expect(link).toHaveAttribute("href", "/admin/settings/integrations")
    expect(link).toHaveAttribute("aria-current", "page")
    expect(
      within(nav).getByRole("link", { name: "AI assistant" })
    ).toHaveAttribute("href", "/admin/settings/ai-assistant")
  })

  it("editors do not", () => {
    renderWith(["editor"], <SettingsTabs>content</SettingsTabs>)
    const nav = screen.getByRole("navigation", { name: "Settings" })
    expect(within(nav).queryByRole("link", { name: "Integrations" })).toBeNull()
    expect(within(nav).queryByRole("link", { name: "AI assistant" })).toBeNull()
  })
})
