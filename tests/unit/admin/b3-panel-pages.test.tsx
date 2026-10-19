import type { ReactElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * MK parity B3: the moved Growth/admin pages and the section index pages,
 * rendered as server components with the session and navigation mocked.
 */
const nav = vi.hoisted(() => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`)
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND")
  }),
  forbidden: vi.fn(() => {
    throw new Error("FORBIDDEN")
  }),
}))
vi.mock("next/navigation", () => nav)

const session = vi.hoisted(() => ({
  roles: ["owner"] as string[],
  requirePermission: vi.fn(),
}))
vi.mock("@/server/auth/session", () => ({
  requirePermission: session.requirePermission,
}))

vi.mock("@/components/admin/settings/settings-editor", () => ({
  SettingsEditor: () => null,
}))
vi.mock("@/components/admin/integrations/integration-form", () => ({
  IntegrationForm: () => null,
}))
vi.mock("@/components/admin/integrations/migrate-media-panel", () => ({
  MigrateMediaPanel: () => null,
}))
vi.mock("@/components/admin/seo/growth-settings-editor", () => ({
  GrowthSettingsEditor: () => null,
}))
vi.mock("@/components/admin/marketing/tracking-editor", () => ({
  TrackingEditor: () => null,
}))
vi.mock("@/components/admin/marketing/consent-editor", () => ({
  ConsentEditor: () => null,
}))
vi.mock("@/components/admin/audit/audit-screen", () => ({
  AuditScreen: () => null,
}))

import CollectionsPage from "@/app/(admin)/admin/(panel)/collections/page"
import ActivityPage from "@/app/(admin)/admin/(panel)/activity/page"
import MarketingCodePage from "@/app/(admin)/admin/(panel)/marketing/code/page"
import MarketingConsentPage from "@/app/(admin)/admin/(panel)/marketing/consent/page"
import MarketingEventsPage from "@/app/(admin)/admin/(panel)/marketing/events/page"
import MarketingPage from "@/app/(admin)/admin/(panel)/marketing/page"
import SettingsKeyPage from "@/app/(admin)/admin/(panel)/settings/[key]/page"
import AiAssistantPage from "@/app/(admin)/admin/(panel)/settings/ai-assistant/page"
import IntegrationPage from "@/app/(admin)/admin/(panel)/settings/integrations/[slug]/page"
import SettingsPage from "@/app/(admin)/admin/(panel)/settings/page"
import { ConsentEditor } from "@/components/admin/marketing/consent-editor"
import { EventsView } from "@/components/admin/marketing/events-view"
import { TrackingEditor } from "@/components/admin/marketing/tracking-editor"
import { GROWTH_SETTINGS } from "@/lib/admin/growth-settings"
import { permissionFor } from "@/lib/admin/nav"
import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"

beforeEach(() => {
  vi.clearAllMocks()
  session.roles = ["owner"]
  session.requirePermission.mockImplementation(
    async (req: PermissionRequest) => {
      if (!hasPermission(session.roles, req)) nav.forbidden()
      return { roles: session.roles }
    }
  )
})

type Props = Record<string, unknown>
/** The page's Suspense child, rendered (the async server component). */
async function inner(page: ReactElement): Promise<ReactElement | null> {
  const child = (page.props as { children: ReactElement }).children
  const render = child.type as (props: Props) => Promise<ReactElement | null>
  return render(child.props as Props)
}
const params = <T,>(value: T) => Promise.resolve(value)

describe("section index pages open their first readable child (registry)", () => {
  it("/admin/settings → the first settings child the role may read", async () => {
    session.roles = ["viewer"]
    await expect(inner(SettingsPage())).rejects.toThrow(
      "REDIRECT /admin/settings/site"
    )
  })

  it("/admin/settings is forbidden without settings:read", async () => {
    session.roles = ["author"]
    await expect(inner(SettingsPage())).rejects.toThrow("FORBIDDEN")
  })

  it("/admin/collections → Team for collection readers", async () => {
    session.roles = ["editor"]
    await expect(inner(CollectionsPage())).rejects.toThrow(
      "REDIRECT /admin/collections/team"
    )
    session.roles = ["author"]
    await expect(inner(CollectionsPage())).rejects.toThrow("FORBIDDEN")
  })
})

describe("/admin/settings/[key]", () => {
  it("an unknown key 404s although permissionFor allows settings readers", async () => {
    // The registry answers for /admin/settings/* by prefix, so the page
    // guard alone would let a reader through; the page 404s on the key.
    expect(permissionFor("/admin/settings/nope")).toEqual({
      settings: ["read"],
    })
    const page = SettingsKeyPage({
      params: params({ key: "nope" }),
    } as never)
    await expect(inner(page)).rejects.toThrow("NOT_FOUND")
    expect(session.requirePermission).not.toHaveBeenCalled()
  })

  it("a growth key is not a Site settings page either", async () => {
    const page = SettingsKeyPage({
      params: params({ key: "customCode" }),
    } as never)
    await expect(inner(page)).rejects.toThrow("NOT_FOUND")
  })
})

describe("moved pages", () => {
  it("/admin/marketing is the Tracking editor (no back link)", async () => {
    const out = await inner(MarketingPage())
    expect(session.requirePermission).toHaveBeenCalledWith(
      GROWTH_SETTINGS.tracking.read
    )
    expect(out!.type).toBe(TrackingEditor)
    expect(out!.props).not.toHaveProperty("backHref")
  })

  it("/admin/marketing/consent is the Consent editor with its live preview (D2.2)", async () => {
    const out = await inner(MarketingConsentPage())
    expect(session.requirePermission).toHaveBeenCalledWith(
      GROWTH_SETTINGS.consent.read
    )
    expect(out!.type).toBe(ConsentEditor)
    expect(out!.props).not.toHaveProperty("backHref")
  })

  it("/admin/marketing/events is the Event catalogue, for marketing readers (D2.4)", async () => {
    session.roles = ["marketer"]
    const out = await inner(MarketingEventsPage())
    expect(session.requirePermission).toHaveBeenCalledWith({
      marketing: ["read"],
    })
    expect(permissionFor("/admin/marketing/events")).toEqual({
      marketing: ["read"],
    })
    expect(out!.type).toBe(EventsView)
    session.roles = ["author"]
    await expect(inner(MarketingEventsPage())).rejects.toThrow("FORBIDDEN")
  })

  it("/admin/marketing/code is Custom code, owner only", async () => {
    const out = await inner(MarketingCodePage())
    expect(out!.props).toMatchObject({ settingsKey: "customCode" })
    expect(out!.props).not.toHaveProperty("backHref")
    session.roles = ["marketer"]
    await expect(inner(MarketingCodePage())).rejects.toThrow("FORBIDDEN")
  })

  it("/admin/activity needs audit:read", async () => {
    await inner(ActivityPage())
    expect(session.requirePermission).toHaveBeenCalledWith({
      audit: ["read"],
    })
    session.roles = ["editor"]
    await expect(inner(ActivityPage())).rejects.toThrow("FORBIDDEN")
  })

  it("/admin/settings/ai-assistant is the AI integration form", async () => {
    const out = await inner(AiAssistantPage())
    expect(out!.props).toMatchObject({ integrationKey: "integrations.ai" })
    session.roles = ["editor"]
    await expect(inner(AiAssistantPage())).rejects.toThrow("FORBIDDEN")
  })

  it("the old AI integration slug redirects to the AI assistant page", async () => {
    const page = IntegrationPage({
      params: params({ slug: "ai" }),
    } as never)
    await expect(inner(page)).rejects.toThrow(
      "REDIRECT /admin/settings/ai-assistant"
    )
    const smtp = await inner(
      IntegrationPage({ params: params({ slug: "smtp" }) } as never)
    )
    expect(smtp!.props).toMatchObject({ integrationKey: "integrations.smtp" })
  })
})
