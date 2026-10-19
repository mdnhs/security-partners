import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  search: new URLSearchParams(),
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/pages/custom/x",
  useRouter: () => ({ push: nav.push, replace: nav.replace, refresh: vi.fn() }),
  useSearchParams: () => nav.search,
}))

import { NewPageDialog } from "@/components/admin/builder/new-page-dialog"
import {
  KEEPALIVE_MAX_BYTES,
  PageBuilder,
  putBuilderDraft,
} from "@/components/admin/builder/page-builder"
import { BUILDER_AUTOSAVE_MS } from "@/components/admin/builder/use-builder-autosave"
import { PageEditor } from "@/components/admin/pages/page-editor"
import { NewPageButton, PagesList } from "@/components/admin/pages/pages-list"
import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { Role } from "@/lib/auth/roles"
import type {
  BuilderPageDto,
  BuilderPageListItem,
} from "@/lib/schemas/api/builder-pages"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { pagesFixture } from "@/server/db/seed/fixtures/pages"

const ID = "0199a000-0000-7000-8000-0000000000aa"
const MEDIA = "00000000-0000-7000-8000-000000000001"

const hero = {
  id: "hero-block-1",
  type: "hero.page" as const,
  anchor: "hero-page",
  hidden: false,
  data: {
    image: { mediaId: MEDIA },
    crumb: "Spring",
    title: "Spring campaign",
    description: "Seasonal offers.",
  },
}
const stats = {
  id: "stats-block-1",
  type: "stats" as const,
  anchor: "stats",
  hidden: false,
  data: { items: [{ value: "24/7", label: "Cover", description: "Always" }] },
}

const page = (over: Partial<BuilderPageDto> = {}): BuilderPageDto => ({
  id: ID,
  slug: "spring-campaign",
  title: "Spring campaign",
  path: "/p/spring-campaign",
  seo: {},
  createdAt: "2026-10-16T09:00:00.000Z",
  draft: { blocks: [hero, stats] },
  published: null,
  version: 2,
  status: "draft",
  dirty: true,
  publishedAt: null,
  updatedAt: "2026-10-16T09:00:00.000Z",
  updatedBy: { id: "u2", name: "Other Editor" },
  ...over,
})

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

type Handler = (init?: RequestInit) => Response | Promise<Response>
let routes: Record<string, Handler>
const calls: { key: string; body: unknown }[] = []
const fetchMock = vi.fn(
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    const key = `${init?.method ?? "GET"} ${url.pathname}`
    calls.push({
      key,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })
    const route = routes[key]
    if (route) return route(init)
    if (url.pathname.startsWith("/api/v1/admin/media/"))
      return json(404, { error: { code: "NOT_FOUND", message: "x" } })
    return json(200, { items: [], page: 1, pageSize: 24, total: 0 })
  }
)
const bodyOf = (init?: RequestInit) =>
  JSON.parse(String(init?.body)) as { version: number; draft?: unknown }

beforeEach(() => {
  nav.push.mockReset()
  nav.replace.mockReset()
  nav.search = new URLSearchParams()
  fetchMock.mockClear()
  calls.length = 0
  vi.stubGlobal("fetch", fetchMock)
  routes = {
    [`GET /api/v1/admin/builder-pages/${ID}`]: () => json(200, page()),
  }
})

function renderWith(children: ReactNode, roles: Role[] = ["editor"]) {
  return render(
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
      {children}
    </AdminShell>
  )
}

const keysCalled = () => calls.map((c) => c.key)

describe("PageBuilder (D5.5)", () => {
  it("header: breadcrumb Pages › title, address, status, actions; outline and block settings", async () => {
    renderWith(<PageBuilder id={ID} />)
    expect(
      await screen.findByRole("heading", { level: 1, name: "Spring campaign" })
    ).toBeInTheDocument()
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" })
    expect(within(crumbs).getByRole("link", { name: "Pages" })).toHaveAttribute(
      "href",
      "/admin/pages"
    )
    expect(screen.getByText("/p/spring-campaign")).toBeInTheDocument()
    expect(screen.getByText("Draft")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "History" })).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /^Preview.*opens in a new tab/ })
    ).toHaveAttribute(
      "href",
      `/api/v1/admin/preview?entity=builder-page&id=${ID}`
    )
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument()
    const outline = screen.getByRole("navigation", { name: "Page outline" })
    expect(
      within(outline).getByRole("button", { name: "Page hero, #hero-page" })
    ).toHaveAttribute("aria-current", "true")
    expect(
      screen.getByRole("region", { name: "Block settings" })
    ).toHaveTextContent("Page hero")
    expect(screen.getByRole("tab", { name: "Content" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
  })

  it("autosaves an edit and shows Saved; Publish flushes it first, then publishes with the version that save returned", async () => {
    const user = userEvent.setup()
    routes[`PUT /api/v1/admin/builder-pages/${ID}/draft`] = (init) =>
      json(200, page({ version: bodyOf(init).version + 1 }))
    routes[`POST /api/v1/admin/builder-pages/${ID}/publish`] = (init) =>
      json(
        200,
        page({
          version: bodyOf(init).version + 1,
          status: "published",
          published: { blocks: [hero, stats] },
          dirty: false,
        })
      )
    renderWith(<PageBuilder id={ID} />)
    const title = await screen.findByRole("textbox", { name: "Title" })
    await user.type(title, "!")
    // Publish before the 1500 ms debounce has fired.
    await user.click(screen.getByRole("button", { name: "Publish" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Publish changes?",
    })
    await user.click(
      within(dialog).getByRole("button", { name: "Publish now" })
    )
    await waitFor(() =>
      expect(keysCalled()).toContain(
        `POST /api/v1/admin/builder-pages/${ID}/publish`
      )
    )
    const save = calls.findIndex((c) => c.key.endsWith("/draft"))
    const pub = calls.findIndex((c) => c.key.endsWith("/publish"))
    expect(save).toBeGreaterThan(-1)
    expect(save).toBeLessThan(pub)
    expect(calls[save].body).toMatchObject({ version: 2 })
    expect(calls[pub].body).toEqual({ version: 3 })
    expect((await screen.findAllByText("Published")).length).toBeGreaterThan(0)
  })

  it("a publish 422 marks the failing block in the outline and selects it", async () => {
    const user = userEvent.setup()
    routes[`POST /api/v1/admin/builder-pages/${ID}/publish`] = () =>
      json(422, {
        error: {
          code: "VALIDATION_FAILED",
          message: "Check the fields",
          fieldErrors: { "blocks.1.data.items.0.value": ["Required"] },
        },
      })
    renderWith(<PageBuilder id={ID} />)
    await user.click(await screen.findByRole("button", { name: "Publish" }))
    await user.click(
      within(
        await screen.findByRole("dialog", { name: "Publish changes?" })
      ).getByRole("button", { name: "Publish now" })
    )
    const stats = await screen.findByRole("button", {
      name: "Stats, #stats, 1 problem",
    })
    expect(stats).toHaveAttribute("aria-current", "true")
    expect(
      screen.getByText("Fix this block before publishing:")
    ).toBeInTheDocument()
  })

  it("an autosave 409 pauses saving and opens the conflict dialog; Reload their version replaces the document", async () => {
    const user = userEvent.setup()
    const theirs = page({
      version: 7,
      draft: {
        blocks: [{ ...hero, data: { ...hero.data, title: "Their title" } }],
      },
    })
    routes[`PUT /api/v1/admin/builder-pages/${ID}/draft`] = () =>
      json(409, {
        error: { code: "CONFLICT", message: "Changed", current: theirs },
      })
    renderWith(<PageBuilder id={ID} />)
    await user.type(await screen.findByRole("textbox", { name: "Title" }), "!")
    const dialog = await screen.findByRole(
      "alertdialog",
      { name: "Someone else changed this" },
      { timeout: BUILDER_AUTOSAVE_MS + 2000 }
    )
    // Behind the modal (inert), so not in the accessibility tree now.
    const publishButton = [...document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "Publish"
    )
    expect(publishButton).toBeDisabled()
    await user.click(
      within(dialog).getByRole("button", { name: "Reload their version" })
    )
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue(
        "Their title"
      )
    )
    expect(
      screen.queryByRole("alertdialog", { name: "Someone else changed this" })
    ).toBeNull()
    const outline = screen.getByRole("navigation", { name: "Page outline" })
    expect(within(outline).queryByRole("button", { name: /^Stats/ })).toBeNull()
  })

  it("read-only roles: view note, no publish, no add block, no row actions", async () => {
    renderWith(<PageBuilder id={ID} />, ["marketer"])
    expect(await screen.findByText("View only.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Add block" })).toBeNull()
    expect(screen.queryByRole("button", { name: /^Delete/ })).toBeNull()
    expect(screen.getByRole("textbox", { name: "Title" })).toBeDisabled()
  })

  it("SEO tab (?tab=seo): title and address with the redirect note, SEO fields", async () => {
    nav.search = new URLSearchParams("tab=seo")
    renderWith(<PageBuilder id={ID} />)
    expect(
      await screen.findByRole("tab", { name: "SEO", selected: true })
    ).toBeInTheDocument()
    const address = screen.getByRole("textbox", { name: "Address" })
    expect(address).toHaveValue("spring-campaign")
    expect(address).toHaveAccessibleDescription(
      expect.stringContaining(
        "Changing the address adds a redirect from the old one"
      )
    )
    expect(
      screen.getByRole("button", { name: "Save title and address" })
    ).toBeDisabled()
    expect(screen.getByRole("button", { name: "Save SEO" })).toBeInTheDocument()
  })

  it("switching tabs writes ?tab= to the URL", async () => {
    const user = userEvent.setup()
    renderWith(<PageBuilder id={ID} />)
    await user.click(await screen.findByRole("tab", { name: "SEO" }))
    expect(nav.replace).toHaveBeenCalledWith("/admin/pages/custom/x?tab=seo", {
      scroll: false,
    })
  })

  it("the address form validates as typed and saves through PATCH meta with the current version", async () => {
    const user = userEvent.setup()
    nav.search = new URLSearchParams("tab=seo")
    routes[`PATCH /api/v1/admin/builder-pages/${ID}/meta`] = () =>
      json(200, page({ version: 3, slug: "spring", path: "/p/spring" }))
    renderWith(<PageBuilder id={ID} />)
    const address = await screen.findByRole("textbox", { name: "Address" })
    await user.clear(address)
    await user.type(address, "Spring!")
    expect(address).toHaveAttribute("aria-invalid", "true")
    await user.clear(address)
    await user.type(address, "spring")
    expect(address).not.toHaveAttribute("aria-invalid")
    await user.click(
      screen.getByRole("button", { name: "Save title and address" })
    )
    await waitFor(() =>
      expect(calls.find((c) => c.key.endsWith("/meta"))?.body).toEqual({
        version: 2,
        slug: "spring",
      })
    )
    expect(await screen.findByText("/p/spring")).toBeInTheDocument()
  })
})

describe("PageBuilder: overwrite and unreadable drafts (review D5.5)", () => {
  it("Overwrite after a publish 409 saves my draft on their version; the server ends up with mine", async () => {
    const user = userEvent.setup()
    const theirs = page({
      version: 9,
      draft: {
        blocks: [{ ...hero, data: { ...hero.data, title: "Their title" } }],
      },
      updatedBy: { id: "u2", name: "Other Editor" },
    })
    // The server: their save already landed.
    let server = { version: 9, draft: theirs.draft as unknown }
    routes[`POST /api/v1/admin/builder-pages/${ID}/publish`] = () =>
      json(409, {
        error: { code: "CONFLICT", message: "Changed", current: theirs },
      })
    routes[`PUT /api/v1/admin/builder-pages/${ID}/draft`] = (init) => {
      const body = bodyOf(init)
      if (body.version !== server.version)
        return json(409, {
          error: { code: "CONFLICT", message: "Changed", current: theirs },
        })
      server = { version: server.version + 1, draft: body.draft }
      return json(
        200,
        page({ version: server.version, draft: body.draft as never })
      )
    }
    renderWith(<PageBuilder id={ID} />)
    // Nothing pending: mine is the loaded draft (hero + stats).
    await user.click(await screen.findByRole("button", { name: "Publish" }))
    await user.click(
      within(
        await screen.findByRole("dialog", { name: "Publish changes?" })
      ).getByRole("button", { name: "Publish now" })
    )
    const dialog = await screen.findByRole("alertdialog", {
      name: "Someone else changed this",
    })
    await user.click(
      within(dialog).getByRole("button", { name: "Overwrite with mine" })
    )
    expect(
      await screen.findByText("Your version replaced theirs")
    ).toBeInTheDocument()
    expect(server).toEqual({ version: 10, draft: { blocks: [hero, stats] } })
    const put = calls.filter((c) => c.key.endsWith("/draft"))
    expect(put).toHaveLength(1)
    expect(put[0].body).toMatchObject({ version: 9 })
  })

  it("a stored draft that no longer parses is shown as a problem list, never saved over", async () => {
    routes[`GET /api/v1/admin/builder-pages/${ID}`] = () =>
      json(
        200,
        page({
          draft: {
            blocks: [hero, { ...stats, type: "richtext", anchor: "services" }],
          } as never,
          // Published, so a Discard button would show if it were offered.
          published: { blocks: [hero, stats] },
          status: "published",
        })
      )
    renderWith(<PageBuilder id={ID} />)
    const alert = await screen.findByRole("alert", {
      name: "This draft cannot be opened in the builder",
    })
    expect(
      within(alert).getByRole("list", { name: "Problems" })
    ).toHaveTextContent('"services" is kept for the Services section')
    expect(
      screen.queryByRole("navigation", { name: "Page outline" })
    ).toBeNull()
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled()
    // Nothing can be saved, so no save pill, no Discard (review D5.5 N2).
    expect(screen.queryByRole("status", { name: /^Save status/ })).toBeNull()
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull()
    await new Promise((r) => setTimeout(r, BUILDER_AUTOSAVE_MS + 300))
    expect(keysCalled().some((k) => k.startsWith("PUT"))).toBe(false)
  })

  it("reloading their unparsable draft after a conflict shows the problems and stops autosave", async () => {
    const user = userEvent.setup()
    const theirs = page({
      version: 7,
      draft: { blocks: [{ ...hero, anchor: "team" }] } as never,
    })
    routes[`PUT /api/v1/admin/builder-pages/${ID}/draft`] = () =>
      json(409, {
        error: { code: "CONFLICT", message: "Changed", current: theirs },
      })
    renderWith(<PageBuilder id={ID} />)
    await user.type(await screen.findByRole("textbox", { name: "Title" }), "!")
    const dialog = await screen.findByRole(
      "alertdialog",
      { name: "Someone else changed this" },
      { timeout: BUILDER_AUTOSAVE_MS + 2000 }
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Reload their version" })
    )
    expect(
      await screen.findByRole("alert", {
        name: "This draft cannot be opened in the builder",
      })
    ).toHaveTextContent('"team" is kept for the Team section')
    // My unsaved edit is not reported as "Unsaved": it can never be saved.
    expect(screen.queryByRole("status", { name: /^Save status/ })).toBeNull()
    expect(screen.queryByText("Unpublished changes")).toBeNull()
    await new Promise((r) => setTimeout(r, BUILDER_AUTOSAVE_MS + 300))
    expect(calls.filter((c) => c.key.startsWith("PUT"))).toHaveLength(1)
  })
})

describe("putBuilderDraft keepalive (review D5.5 M6)", () => {
  it("a closing-tab save under 64 KB is a keepalive fetch; a larger one uses the normal client", async () => {
    routes[`PUT /api/v1/admin/builder-pages/${ID}/draft`] = () =>
      json(200, page())
    await putBuilderDraft(ID, { blocks: [hero] }, 2, true)
    const small = fetchMock.mock.calls.at(-1)!
    expect(small[1]).toMatchObject({ method: "PUT", keepalive: true })

    const big = {
      blocks: [
        {
          ...hero,
          data: { ...hero.data, description: "x".repeat(KEEPALIVE_MAX_BYTES) },
        },
      ],
    }
    await putBuilderDraft(ID, big, 2, true)
    const large = fetchMock.mock.calls.at(-1)!
    expect((large[1] as RequestInit | undefined)?.keepalive).toBeUndefined()

    await putBuilderDraft(ID, { blocks: [hero] }, 2)
    expect(
      (fetchMock.mock.calls.at(-1)![1] as RequestInit | undefined)?.keepalive
    ).toBeUndefined()
  })
})

describe("NewPageDialog", () => {
  it("fills the address from the title, creates the page and opens it", async () => {
    const user = userEvent.setup()
    routes["POST /api/v1/admin/builder-pages"] = () => json(201, page())
    renderWith(<NewPageDialog open onOpenChange={() => {}} />)
    const dialog = await screen.findByRole("dialog", { name: "New page" })
    await user.type(
      within(dialog).getByRole("textbox", { name: "Title" }),
      "Spring Campaign"
    )
    expect(
      within(dialog).getByRole("textbox", { name: "Address" })
    ).toHaveValue("spring-campaign")
    await user.click(
      within(dialog).getByRole("button", { name: "Create page" })
    )
    await waitFor(() =>
      expect(nav.push).toHaveBeenCalledWith(`/admin/pages/custom/${ID}`)
    )
    expect(calls.find((c) => c.key.startsWith("POST"))?.body).toEqual({
      title: "Spring Campaign",
      slug: "spring-campaign",
    })
  })

  it("refuses reserved and malformed addresses as typed; a taken one shows the server's 409 on the field", async () => {
    const user = userEvent.setup()
    routes["POST /api/v1/admin/builder-pages"] = () =>
      json(409, {
        error: {
          code: "CONFLICT",
          message: "Another page already uses this address",
          fieldErrors: { slug: ["Already used by another page"] },
        },
      })
    renderWith(<NewPageDialog open onOpenChange={() => {}} />)
    const dialog = await screen.findByRole("dialog", { name: "New page" })
    await user.type(within(dialog).getByRole("textbox", { name: "Title" }), "X")
    const address = within(dialog).getByRole("textbox", { name: "Address" })
    await user.clear(address)
    await user.type(address, "admin")
    expect(address).toHaveAccessibleDescription(
      expect.stringContaining("This address is reserved")
    )
    await user.clear(address)
    await user.type(address, "taken")
    await user.click(
      within(dialog).getByRole("button", { name: "Create page" })
    )
    await waitFor(() =>
      expect(address).toHaveAccessibleDescription(
        expect.stringContaining("Already used by another page")
      )
    )
    expect(nav.push).not.toHaveBeenCalled()
  })

  it("a copy's cut notes are shown before creating it", async () => {
    renderWith(
      <NewPageDialog
        open
        onOpenChange={() => {}}
        seed={{
          title: "Privacy copy",
          slug: "privacy-copy",
          doc: { blocks: [hero] },
          notes: ["The text is longer than one Text block holds."],
        }}
      />
    )
    const note = await screen.findByRole("note", { name: "Before you copy" })
    expect(note).toHaveTextContent("longer than one Text block holds")
  })

  it("with a seed (Copy to new page) sends the copied blocks", async () => {
    const user = userEvent.setup()
    routes["POST /api/v1/admin/builder-pages"] = () => json(201, page())
    renderWith(
      <NewPageDialog
        open
        onOpenChange={() => {}}
        seed={{
          title: "About copy",
          slug: "about-copy",
          doc: { blocks: [hero] },
        }}
      />
    )
    const dialog = await screen.findByRole("dialog", {
      name: "Copy to a new page",
    })
    expect(
      within(dialog).getByRole("textbox", { name: "Address" })
    ).toHaveValue("about-copy")
    await user.click(
      within(dialog).getByRole("button", { name: "Create copy" })
    )
    await waitFor(() =>
      expect(calls.find((c) => c.key.startsWith("POST"))?.body).toEqual({
        title: "About copy",
        slug: "about-copy",
        seed: { blocks: [hero] },
      })
    )
  })
})

describe("Pages list: Site pages and Custom pages", () => {
  const item: BuilderPageListItem = {
    id: ID,
    slug: "spring-campaign",
    title: "Spring campaign",
    path: "/p/spring-campaign",
    status: "published",
    hasUnpublishedChanges: true,
    updatedAt: new Date().toISOString(),
    updatedByName: "Edith",
  }
  beforeEach(() => {
    routes["GET /api/v1/admin/builder-pages"] = () =>
      json(200, { items: [item] })
  })

  it("lists custom pages linking to the builder; editors get New page", async () => {
    renderWith(
      <>
        <NewPageButton />
        <PagesList />
      </>
    )
    expect(
      await screen.findByRole("heading", { name: "Site pages" })
    ).toBeInTheDocument()
    const table = await screen.findByRole("table", { name: "Custom pages" })
    expect(
      within(table).getByRole("link", { name: "Spring campaign" })
    ).toHaveAttribute("href", `/admin/pages/custom/${ID}`)
    expect(within(table).getByText("Unpublished changes")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New page" })).toBeInTheDocument()
  })

  it("marketers see the list read-only: no New page", async () => {
    renderWith(
      <>
        <NewPageButton />
        <PagesList />
      </>,
      ["marketer"]
    )
    expect(
      await screen.findByRole("table", { name: "Custom pages" })
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "New page" })).toBeNull()
  })

  it("?new=1 (⌘K New page) opens the dialog; closing drops the parameter", async () => {
    const user = userEvent.setup()
    nav.search = new URLSearchParams("new=1")
    renderWith(<NewPageButton />)
    const dialog = await screen.findByRole("dialog", { name: "New page" })
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))
    expect(nav.replace).toHaveBeenCalledWith("/admin/pages/custom/x", {
      scroll: false,
    })
    await act(async () => {})
  })
})

describe("Copy to new page (fixed page editor)", () => {
  const about = pagesFixture(fixtureMediaLookup).about.data
  const aboutDto = {
    key: "about",
    label: "About",
    template: "about",
    path: "/about",
    draft: about,
    published: about,
    version: 4,
    status: "published",
    dirty: false,
    publishedAt: "2026-10-16T09:00:00.000Z",
    updatedAt: "2026-10-16T09:00:00.000Z",
    updatedBy: null,
  }
  beforeEach(() => {
    routes["GET /api/v1/admin/pages/about"] = () => json(200, aboutDto)
    routes["POST /api/v1/admin/builder-pages"] = () => json(201, page())
  })

  it("seeds a NEW builder page at /p/about-copy with About's blocks; the fixed page is not written", async () => {
    const user = userEvent.setup()
    renderWith(<PageEditor pageKey="about" />)
    await user.click(
      await screen.findByRole("button", { name: "Copy to new page" })
    )
    const dialog = await screen.findByRole("dialog", {
      name: "Copy to a new page",
    })
    expect(within(dialog).getByRole("textbox", { name: "Title" })).toHaveValue(
      "About copy"
    )
    expect(
      within(dialog).getByRole("textbox", { name: "Address" })
    ).toHaveValue("about-copy")
    await user.click(
      within(dialog).getByRole("button", { name: "Create copy" })
    )
    await waitFor(() =>
      expect(nav.push).toHaveBeenCalledWith(`/admin/pages/custom/${ID}`)
    )
    const post = calls.find((c) => c.key === "POST /api/v1/admin/builder-pages")
    const body = post?.body as { seed: { blocks: { type: string }[] } }
    expect(body.seed.blocks.map((b) => b.type)).toEqual([
      "hero.page",
      "about",
      "stats",
      "iconCards",
      "clients",
      "enquireBanner",
    ])
    expect(
      calls.filter(
        (c) => c.key.includes("/pages/about") && !c.key.startsWith("GET")
      )
    ).toEqual([])
  })

  it("no Copy to new page without page:create", async () => {
    renderWith(<PageEditor pageKey="about" />, ["marketer"])
    expect(
      await screen.findByRole("heading", { level: 1, name: "About" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Copy to new page" })
    ).toBeNull()
  })
})
