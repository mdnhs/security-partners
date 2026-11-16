import type { ReactElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The Website screens (Phase 3 Task 2) rendered as server components with
 * the session and navigation mocked, as in b3-panel-pages.test.tsx.
 * Review Focus 1 (an author lands on /admin/insights) and 4 (a wrong segment
 * is a 404 after sign-in) are pinned here.
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
  requireActor: vi.fn(),
  requirePermission: vi.fn(),
  requirePage: vi.fn(),
}))
vi.mock("@/server/auth/session", () => ({
  requireActor: session.requireActor,
  requirePermission: session.requirePermission,
  requirePage: session.requirePage,
}))

vi.mock("@/server/modules/seo/queries", () => ({
  getSiteOrigin: async () => "https://example.ie",
}))
vi.mock("@/components/admin/pages/page-editor", () => ({
  PageEditor: () => null,
}))
vi.mock("@/components/admin/collections/collection-screen", () => ({
  CollectionScreen: () => null,
}))
vi.mock("@/components/admin/settings/settings-editor", () => ({
  SettingsEditor: () => null,
}))
vi.mock("@/components/admin/website/website-tabs", () => ({
  WebsiteTabs: () => null,
}))

import WebsitePartPage from "@/app/(admin)/admin/(panel)/website/[key]/[part]/page"
import WebsiteScreenPage from "@/app/(admin)/admin/(panel)/website/[key]/page"
import LegalFixedPage from "@/app/(admin)/admin/(panel)/website/legal/[page]/page"
import WebsitePage from "@/app/(admin)/admin/(panel)/website/page"
import { permissionFor } from "@/lib/admin/nav"
import { SETTINGS_ENTRIES } from "@/lib/admin/settings-keys"
import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"

beforeEach(() => {
  vi.clearAllMocks()
  session.roles = ["owner"]
  session.requireActor.mockImplementation(async () => ({
    roles: session.roles,
  }))
  session.requirePermission.mockImplementation(
    async (req: PermissionRequest) => {
      if (!hasPermission(session.roles, req)) nav.forbidden()
      return { roles: session.roles }
    }
  )
  // A copy of requirePage (server/auth/session.ts) over the mocked guards.
  session.requirePage.mockImplementation(async (href: string) => {
    const permission = permissionFor(href)
    if (permission === undefined) nav.notFound()
    if (permission === null) return session.requireActor()
    return session.requirePermission(permission)
  })
})

type Props = Record<string, unknown>
/** The page's Suspense child, rendered (the async server component). */
async function inner(page: ReactElement): Promise<ReactElement | null> {
  const child = (page.props as { children: ReactElement }).children
  const render = child.type as (props: Props) => Promise<ReactElement | null>
  return render(child.props as Props)
}
const screenPage = (key: string) =>
  inner(
    WebsiteScreenPage({
      params: Promise.resolve({ key }),
    } as Parameters<typeof WebsiteScreenPage>[0])
  )
const legalPage = (page: string) =>
  inner(
    LegalFixedPage({
      params: Promise.resolve({ page }),
    } as Parameters<typeof LegalFixedPage>[0])
  )
const partPage = (key: string, part: string) =>
  inner(
    WebsitePartPage({
      params: Promise.resolve({ key, part }),
    } as Parameters<typeof WebsitePartPage>[0])
  )

describe("/admin/website opens the first screen the roles may open", () => {
  it("→ Home for an owner", async () => {
    await expect(inner(WebsitePage())).rejects.toThrow(
      "REDIRECT /admin/website/home"
    )
    expect(session.requirePage).toHaveBeenCalledWith("/admin/website")
  })

  it("→ Blog for an author", async () => {
    session.roles = ["author"]
    await expect(inner(WebsitePage())).rejects.toThrow(
      "REDIRECT /admin/website/blog"
    )
  })

  it("is forbidden when no screen is visible", async () => {
    session.roles = ["intake"]
    await expect(inner(WebsitePage())).rejects.toThrow("FORBIDDEN")
  })
})

describe("/admin/website/[key]", () => {
  it("renders Home for an owner behind its own guard", async () => {
    await expect(screenPage("home")).resolves.toBeTruthy()
    expect(session.requirePage).toHaveBeenCalledWith("/admin/website/home")
  })

  it("renders Team (a page with its members list)", async () => {
    await expect(screenPage("team")).resolves.toBeTruthy()
  })

  it("sends an author on Blog to the Articles tab (no 403, no loop)", async () => {
    session.roles = ["author"]
    await expect(screenPage("blog")).rejects.toThrow("REDIRECT /admin/insights")
    // /admin/insights is guarded by article:read, which authors hold.
    expect(hasPermission(["author"], permissionFor("/admin/insights")!)).toBe(
      true
    )
  })

  it("is a 404 for an unknown key, after sign-in", async () => {
    await expect(screenPage("nope")).rejects.toThrow("NOT_FOUND")
    expect(session.requirePage).toHaveBeenCalledWith("/admin/website/nope")
    expect(session.requireActor).toHaveBeenCalled()
  })

  it("is a 404 for a legal page key (edited under Legal pages)", async () => {
    await expect(screenPage("privacy")).rejects.toThrow("NOT_FOUND")
  })

  it("opens Header & footer on its first part (no Page tab)", async () => {
    await expect(screenPage("header-footer")).rejects.toThrow(
      "REDIRECT /admin/website/header-footer/navigation"
    )
  })

  it("is forbidden for a role that may read none of the screen", async () => {
    session.roles = ["intake"]
    await expect(screenPage("home")).rejects.toThrow("FORBIDDEN")
  })
})

describe("/admin/website/[key]/[part]", () => {
  it("renders a collection part behind its own permission", async () => {
    await expect(partPage("home", "clients")).resolves.toBeTruthy()
    expect(session.requirePage).toHaveBeenCalledWith("/admin/website/home")
    expect(session.requirePermission).toHaveBeenCalledWith({
      collection: ["read"],
    })
  })

  it("is a 404 for a part homed on another screen", async () => {
    await expect(partPage("home", "footer")).rejects.toThrow("NOT_FOUND")
  })

  it("is a 404 for a route part (it lives at its own URL)", async () => {
    await expect(partPage("blog", "articles")).rejects.toThrow("NOT_FOUND")
    await expect(partPage("services", "all-services")).rejects.toThrow(
      "NOT_FOUND"
    )
  })

  it("is a 404 under an unknown key, after sign-in", async () => {
    await expect(partPage("nope", "team")).rejects.toThrow("NOT_FOUND")
    expect(session.requireActor).toHaveBeenCalled()
  })

  it("checks a settings part's own read permission", async () => {
    await expect(partPage("about", "about-section")).resolves.toBeTruthy()
    expect(session.requirePermission).toHaveBeenCalledWith(
      SETTINGS_ENTRIES["sections.about"].read
    )
  })

  it("forbids a marketer a settings part (no settings:read)", async () => {
    session.roles = ["marketer"]
    await expect(partPage("contact", "contact-details")).rejects.toThrow(
      "FORBIDDEN"
    )
  })
})

describe("/admin/website/legal/[page]", () => {
  it("renders Privacy policy behind Legal pages' guard", async () => {
    await expect(legalPage("privacy")).resolves.toBeTruthy()
    expect(session.requirePage).toHaveBeenCalledWith("/admin/website/legal")
  })

  it("is a 404 for any other page", async () => {
    await expect(legalPage("home")).rejects.toThrow("NOT_FOUND")
  })
})
