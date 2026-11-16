import type { ReactElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The old Pages, Collections and Settings URLs (Phase 3 Task 3) now 307 to
 * the Website screens, keeping the query (Review Focus 3). Unregistered
 * stubs sign in first (`requireActor`), so a stranger never learns which
 * paths exist, then 404 or check the permission, then redirect.
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
  order: [] as string[],
  requireActor: vi.fn(),
  requirePermission: vi.fn(),
  requirePage: vi.fn(),
}))
vi.mock("@/server/auth/session", () => ({
  requireActor: session.requireActor,
  requirePermission: session.requirePermission,
  requirePage: session.requirePage,
}))

vi.mock("@/components/admin/settings/settings-editor", () => ({
  SettingsEditor: () => null,
}))

import CollectionPage from "@/app/(admin)/admin/(panel)/collections/[name]/page"
import CollectionsPage from "@/app/(admin)/admin/(panel)/collections/page"
import PageKeyPage from "@/app/(admin)/admin/(panel)/pages/[key]/page"
import LegalPage from "@/app/(admin)/admin/(panel)/pages/legal/page"
import PagesPage from "@/app/(admin)/admin/(panel)/pages/page"
import SettingsKeyPage from "@/app/(admin)/admin/(panel)/settings/[key]/page"
import { SettingsEditor } from "@/components/admin/settings/settings-editor"
import { permissionFor } from "@/lib/admin/nav"
import { SETTINGS_ENTRIES } from "@/lib/admin/settings-keys"
import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"

beforeEach(() => {
  vi.clearAllMocks()
  session.roles = ["owner"]
  session.order = []
  session.requireActor.mockImplementation(async () => {
    session.order.push("requireActor")
    return { roles: session.roles }
  })
  session.requirePermission.mockImplementation(
    async (req: PermissionRequest) => {
      session.order.push("requirePermission")
      if (!hasPermission(session.roles, req)) nav.forbidden()
      return { roles: session.roles }
    }
  )
  session.requirePage.mockImplementation(async (href: string) => {
    const permission = permissionFor(href)
    if (permission === undefined) nav.notFound()
    if (permission === null) return session.requireActor()
    return session.requirePermission(permission)
  })
  nav.notFound.mockImplementation(() => {
    session.order.push("notFound")
    throw new Error("NOT_FOUND")
  })
})

type Props = Record<string, unknown>
/** The page's Suspense child, rendered (the async server component). */
async function inner(page: ReactElement): Promise<ReactElement | null> {
  const child = (page.props as { children: ReactElement }).children
  const render = child.type as (props: Props) => Promise<ReactElement | null>
  return render(child.props as Props)
}
type Search = Record<string, string | string[] | undefined>
const props = (params: Record<string, string>, search: Search = {}) =>
  ({
    params: Promise.resolve(params),
    searchParams: Promise.resolve(search),
  }) as never

describe("old Pages URLs", () => {
  it("/admin/pages → /admin/website (any signed-in user)", async () => {
    await expect(inner(PagesPage(props({})))).rejects.toThrow(
      "REDIRECT /admin/website"
    )
    expect(session.requireActor).toHaveBeenCalled()
    expect(session.requirePage).not.toHaveBeenCalled()
  })

  it("/admin/pages?new=1 opens New page on Custom pages", async () => {
    await expect(inner(PagesPage(props({}, { new: "1" })))).rejects.toThrow(
      "REDIRECT /admin/website/custom-pages?new=1"
    )
  })

  it("/admin/pages/<key> → /admin/website/<key> behind page:read", async () => {
    await expect(inner(PageKeyPage(props({ key: "about" })))).rejects.toThrow(
      "REDIRECT /admin/website/about"
    )
    expect(session.order).toEqual(["requireActor", "requirePermission"])
    expect(session.requirePermission).toHaveBeenCalledWith({ page: ["read"] })
  })

  it("/admin/pages/home?tab=seo → /admin/website/home?tab=seo", async () => {
    await expect(
      inner(PageKeyPage(props({ key: "home" }, { tab: "seo" })))
    ).rejects.toThrow("REDIRECT /admin/website/home?tab=seo")
  })

  it("/admin/pages/privacy → /admin/website/legal/privacy", async () => {
    await expect(
      inner(PageKeyPage(props({ key: "privacy" }, { tab: "seo" })))
    ).rejects.toThrow("REDIRECT /admin/website/legal/privacy?tab=seo")
  })

  it("/admin/pages/<unknown> is a 404 after sign-in", async () => {
    await expect(inner(PageKeyPage(props({ key: "nope" })))).rejects.toThrow(
      "NOT_FOUND"
    )
    expect(session.order).toEqual(["requireActor", "notFound"])
  })

  it("/admin/pages/<key> is forbidden without page:read", async () => {
    session.roles = ["author"]
    await expect(inner(PageKeyPage(props({ key: "home" })))).rejects.toThrow(
      "FORBIDDEN"
    )
  })

  it("/admin/pages/legal → /admin/website/legal behind page:read", async () => {
    await expect(
      inner(LegalPage(props({}, { x: ["1", "2"] })))
    ).rejects.toThrow("REDIRECT /admin/website/legal?x=1&x=2")
    expect(session.order).toEqual(["requireActor", "requirePermission"])
    expect(session.requirePermission).toHaveBeenCalledWith({ page: ["read"] })
  })
})

describe("old Collections URLs", () => {
  it("/admin/collections → /admin/website", async () => {
    await expect(inner(CollectionsPage(props({})))).rejects.toThrow(
      "REDIRECT /admin/website"
    )
    expect(session.requireActor).toHaveBeenCalled()
  })

  it("/admin/collections/<name> → its Website part behind collection:read", async () => {
    await expect(
      inner(CollectionPage(props({ name: "clients" })))
    ).rejects.toThrow("REDIRECT /admin/website/home/clients")
    expect(session.order).toEqual(["requireActor", "requirePermission"])
    expect(session.requirePermission).toHaveBeenCalledWith({
      collection: ["read"],
    })
  })

  it("/admin/collections/team?edit=abc → /admin/website/team/team?edit=abc", async () => {
    await expect(
      inner(CollectionPage(props({ name: "team" }, { edit: "abc" })))
    ).rejects.toThrow("REDIRECT /admin/website/team/team?edit=abc")
  })

  it("/admin/collections/group-companies → Header & footer", async () => {
    await expect(
      inner(CollectionPage(props({ name: "group-companies" })))
    ).rejects.toThrow("REDIRECT /admin/website/header-footer/group-companies")
  })

  it("/admin/collections/categories → /admin/insights/categories", async () => {
    await expect(
      inner(CollectionPage(props({ name: "categories" })))
    ).rejects.toThrow("REDIRECT /admin/insights/categories")
  })

  it("/admin/collections/nope is a 404 after sign-in", async () => {
    await expect(
      inner(CollectionPage(props({ name: "nope" })))
    ).rejects.toThrow("NOT_FOUND")
    expect(session.order).toEqual(["requireActor", "notFound"])
  })

  it("is forbidden without collection:read", async () => {
    session.roles = ["author"]
    await expect(
      inner(CollectionPage(props({ name: "team" })))
    ).rejects.toThrow("FORBIDDEN")
  })
})

describe("old Settings URLs", () => {
  it("/admin/settings/footer?x=1 → /admin/website/header-footer/footer?x=1", async () => {
    await expect(
      inner(SettingsKeyPage(props({ key: "footer" }, { x: "1" })))
    ).rejects.toThrow("REDIRECT /admin/website/header-footer/footer?x=1")
    expect(session.requirePage).toHaveBeenCalledWith("/admin/settings")
    expect(session.requirePermission).toHaveBeenCalledWith(
      SETTINGS_ENTRIES.footer.read
    )
  })

  it("/admin/settings/contact → /admin/website/contact/contact-details", async () => {
    await expect(
      inner(SettingsKeyPage(props({ key: "contact" })))
    ).rejects.toThrow("REDIRECT /admin/website/contact/contact-details")
  })

  it("a moved key keeps its own read permission before redirecting", async () => {
    session.roles = ["author"]
    await expect(
      inner(SettingsKeyPage(props({ key: "sections.clients" })))
    ).rejects.toThrow("FORBIDDEN")
  })

  it("/admin/settings/site still renders (not moved)", async () => {
    const out = await inner(SettingsKeyPage(props({ key: "site" })))
    expect(out!.type).toBe(SettingsEditor)
    expect(out!.props).toMatchObject({ settingsKey: "site" })
  })
})
