import { renderToString } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { preview } = vi.hoisted(() => ({
  preview: { on: false, fail: false },
}))
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: vi.fn(async () => undefined),
}))
vi.mock("@/server/modules/preview/guard", () => ({
  isPreviewing: async () => {
    if (preview.fail) throw new Error("database down")
    return preview.on
  },
}))

import { AdminThemeStyle } from "@/components/admin/theme/admin-theme-style"
import { SiteThemeStyle } from "@/components/site-theme-style"
import type { ThemeConfigValue } from "@/lib/theme/schema"
import type { Actor } from "@/server/lib/actor"
import { getDb } from "@/server/db/client"
import { seedContent } from "@/server/db/seed"
import {
  getTheme,
  publishTheme,
  saveThemeDraft,
} from "@/server/modules/theme/service"

import { resetDb } from "../db"
import { createUser } from "../helpers/auth"

let owner: Actor

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  const user = await createUser({ roles: ["owner"] })
  owner = {
    userId: user.id,
    roles: ["owner"],
    ip: null,
    userAgent: null,
    impersonatorId: null,
  }
  preview.on = false
  preview.fail = false
})

async function saveDraft(
  edit: (t: ThemeConfigValue) => ThemeConfigValue
): Promise<number> {
  const current = await getTheme(owner)
  const dto = await saveThemeDraft(owner, {
    version: current.version,
    draft: edit(current.draft),
  })
  return dto.version
}

async function publishEdit(edit: (t: ThemeConfigValue) => ThemeConfigValue) {
  const version = await saveDraft(edit)
  await publishTheme(owner, { version })
}

const withBrand = (t: ThemeConfigValue): ThemeConfigValue => ({
  ...t,
  site: { ...t.site, brand: "#49925e" },
})

const siteHtml = async () => renderToString(await SiteThemeStyle())
const adminHtml = async () => renderToString(await AdminThemeStyle())

describe("SiteThemeStyle", () => {
  it("seeded DB: site renders no style tag", async () => {
    expect(await siteHtml()).toBe("")
  })

  it("published brand change: site renders :root override", async () => {
    await publishEdit(withBrand)
    const html = await siteHtml()
    expect(html).toContain('<style id="site-theme">:root{--color-brand-green:')
    // Rebuilt from numbers only: no stored string reaches the tag.
    expect(html).not.toContain("#49925e")
  })

  it("an unpublished draft reaches only a verified previewer", async () => {
    await saveDraft(withBrand)
    expect(await siteHtml()).toBe("")
    preview.on = true
    expect(await siteHtml()).toContain('<style id="site-theme">:root{')
  })

  it("fails closed to nothing on any error", async () => {
    await publishEdit(withBrand)
    preview.fail = true
    expect(await siteHtml()).toBe("")
  })
})

describe("AdminThemeStyle", () => {
  it("admin default renders no theme-tokens style", async () => {
    const html = await adminHtml()
    expect(html).not.toContain("theme-tokens")
    expect(html).not.toContain("<style")
  })

  it("published admin change renders the admin scopes", async () => {
    await publishEdit((t) => ({ ...t, admin: { ...t.admin, radius: 1 } }))
    const html = await adminHtml()
    expect(html).toContain(
      '<style id="theme-tokens">html[data-admin]{--radius:1rem}'
    )
  })

  it("a draft never reaches the admin, even for a previewer", async () => {
    await saveDraft((t) => ({ ...t, admin: { ...t.admin, radius: 1 } }))
    preview.on = true
    expect(await adminHtml()).not.toContain("theme-tokens")
  })
})
