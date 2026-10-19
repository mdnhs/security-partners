import { Writable } from "node:stream"

import {
  renderToPipeableStream,
  renderToReadableStream,
  renderToString,
} from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { flags } = vi.hoisted(() => ({
  flags: {
    preview: false,
    previewFails: false,
    publishedFails: false,
    hold: undefined as Promise<void> | undefined,
    previewHold: undefined as Promise<void> | undefined,
  },
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
    // getPreviewableSiteTheme reads the published theme through its own
    // binding (not this module mock), so the site read is held here.
    await flags.previewHold
    if (flags.previewFails) throw new Error("preview check failed")
    return flags.preview
  },
}))
vi.mock("@/server/modules/theme/queries", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("@/server/modules/theme/queries")>()
  return {
    ...real,
    getPublishedTheme: async () => {
      await flags.hold
      if (flags.publishedFails) throw new Error("database down")
      return real.getPublishedTheme()
    },
  }
})

import { AdminThemeStyle } from "@/components/admin/theme/admin-theme-style"
import { AdminThemed } from "@/components/admin/theme/admin-themed"
import { modeScript } from "@/components/admin/theme/default-mode"
import { SiteThemeStyle } from "@/components/site-theme-style"
import { SiteThemed } from "@/components/site-themed"
import type { ThemeConfigValue } from "@/lib/theme/schema"
import { getDb } from "@/server/db/client"
import { seedContent } from "@/server/db/seed"
import type { Actor } from "@/server/lib/actor"
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
  flags.preview = false
  flags.previewFails = false
  flags.publishedFails = false
  flags.hold = undefined
  flags.previewHold = undefined
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

const withAdmin =
  (admin: Partial<ThemeConfigValue["admin"]>) =>
  (t: ThemeConfigValue): ThemeConfigValue => ({
    ...t,
    admin: { ...t.admin, ...admin },
  })

const siteHtml = async () => renderToString(await SiteThemeStyle())
const adminHtml = async () => renderToString(await AdminThemeStyle())

/** The streamed HTML with every boundary resolved. */
async function streamHtml(node: React.ReactNode): Promise<string> {
  const stream = await renderToReadableStream(node)
  await stream.allReady
  return new Response(stream).text()
}

/**
 * Streams `themed` after a shell while the theme read is held (the caller
 * sets the hold): React may stream the content early, but only into a
 * hidden segment, and the boundary is not revealed (no $RC) until the read
 * inside it completes.
 */
async function expectContentHeld(themed: React.ReactNode): Promise<void> {
  let shell = ""
  const sink = new Writable({
    write(chunk: Buffer, _enc, done) {
      shell += chunk.toString()
      done()
    },
  })
  const { abort } = await new Promise<{ abort: () => void }>((resolve) => {
    const r = renderToPipeableStream(
      <html>
        <body>
          <p>Shell</p>
          {themed}
        </body>
      </html>,
      { onShellReady: () => resolve(r) }
    )
    r.pipe(sink)
  })
  await new Promise((r) => setTimeout(r, 50))
  try {
    expect(shell).toContain("<p>Shell</p>")
    const hidden = shell.indexOf("<div hidden")
    const content = shell.indexOf('id="content"')
    if (content > -1) {
      expect(hidden).toBeGreaterThan(-1)
      expect(content).toBeGreaterThan(hidden)
    }
    expect(shell).not.toMatch(/\$RC\(/)
  } finally {
    abort()
  }
}

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
    flags.preview = true
    expect(await siteHtml()).toContain('<style id="site-theme">:root{')
  })

  it("a failing preview check keeps the published theme", async () => {
    await publishEdit(withBrand)
    flags.previewFails = true
    expect(await siteHtml()).toContain('<style id="site-theme">:root{')
  })

  it("fails closed to nothing when the theme cannot be read", async () => {
    await publishEdit(withBrand)
    flags.previewFails = true
    flags.publishedFails = true
    expect(await siteHtml()).toBe("")
  })
})

describe("AdminThemeStyle", () => {
  it("admin default renders no theme-tokens style", async () => {
    const html = await adminHtml()
    expect(html).not.toContain("theme-tokens")
    expect(html).not.toContain("<style")
  })

  it("emits the pre-paint mode script for the published mode", async () => {
    expect(await adminHtml()).toContain(modeScript("system"))
    await publishEdit(withAdmin({ mode: "dark" }))
    expect(await adminHtml()).toContain(modeScript("dark"))
  })

  it("published admin change renders the admin scopes", async () => {
    await publishEdit(withAdmin({ radius: 1 }))
    const html = await adminHtml()
    expect(html).toContain(
      '<style id="theme-tokens">html[data-admin]{--radius:1rem}'
    )
  })

  it("a draft never reaches the admin, even for a previewer", async () => {
    await saveDraft(withAdmin({ radius: 1 }))
    flags.preview = true
    expect(await adminHtml()).not.toContain("theme-tokens")
  })

  it("fails closed to nothing when the theme cannot be read", async () => {
    flags.publishedFails = true
    expect(await adminHtml()).toBe("")
  })
})

describe("AdminThemed (one boundary for theme + content)", () => {
  it("the overrides and mode script come ahead of the content", async () => {
    await publishEdit(withAdmin({ radius: 1, mode: "dark" }))
    const html = await streamHtml(
      <AdminThemed>
        <p id="content">Content</p>
      </AdminThemed>
    )
    const style = html.indexOf('<style id="theme-tokens">')
    const script = html.indexOf(modeScript("dark"))
    const content = html.indexOf('<p id="content">')
    expect(style).toBeGreaterThan(-1)
    expect(script).toBeGreaterThan(-1)
    expect(content).toBeGreaterThan(style)
    expect(content).toBeGreaterThan(script)
  })

  it("the content waits for the theme read (one boundary)", async () => {
    let release = () => {}
    // A theme read that never settles: nothing of the content may render.
    flags.hold = new Promise<void>((resolve) => (release = resolve))
    await expectContentHeld(
      <AdminThemed>
        <p id="content">Content</p>
      </AdminThemed>
    )
    release()
  })

  it("default theme: the content streams with no style", async () => {
    const html = await streamHtml(
      <AdminThemed>
        <p id="content">Content</p>
      </AdminThemed>
    )
    expect(html).toContain('<p id="content">Content</p>')
    expect(html).not.toContain("<style")
  })
})

describe("SiteThemed (a page's content + the brand overrides)", () => {
  it("the overrides come ahead of the page content", async () => {
    await publishEdit(withBrand)
    const html = await streamHtml(
      <SiteThemed>
        <main id="content">Content</main>
      </SiteThemed>
    )
    const style = html.indexOf('<style id="site-theme">')
    expect(style).toBeGreaterThan(-1)
    expect(html.indexOf('<main id="content">')).toBeGreaterThan(style)
  })

  it("the page content waits for the theme read (one boundary)", async () => {
    let release = () => {}
    // The site read starts with the preview check: hold that and the
    // content must stay unrevealed.
    flags.previewHold = new Promise<void>((resolve) => (release = resolve))
    await expectContentHeld(
      <SiteThemed>
        <p id="content">Content</p>
      </SiteThemed>
    )
    release()
  })

  it("default theme: the page content alone", async () => {
    const html = await streamHtml(
      <SiteThemed>
        <main id="content">Content</main>
      </SiteThemed>
    )
    expect(html).toContain('<main id="content">Content</main>')
    expect(html).not.toContain("<style")
  })

  it("a second instance (the consent banner's boundary) takes its own id", async () => {
    await publishEdit(withBrand)
    expect(
      renderToString(await SiteThemeStyle({ id: "site-theme-extras" }))
    ).toContain('<style id="site-theme-extras">:root{')
  })
})
