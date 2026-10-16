import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/pages/home",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

import { PageEditor } from "@/components/admin/pages/page-editor"
import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { PageDto } from "@/lib/schemas/api/content"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { pagesFixture } from "@/server/db/seed/fixtures/pages"

const home = pagesFixture(fixtureMediaLookup).home.data

const dto = (version: number, heading: string, published = home): PageDto => ({
  key: "home",
  label: "Home",
  template: "home",
  path: "/",
  draft: { ...home, hero: { ...home.hero, heading } },
  published,
  version,
  status: "published",
  dirty: heading !== published.hero.heading,
  publishedAt: "2026-10-16T09:00:00.000Z",
  updatedAt: "2026-10-16T10:00:00.000Z",
  updatedBy: { id: "u2", name: "Other Editor" },
})

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

let routes: Record<string, (init?: RequestInit) => Response>
const fetchMock = vi.fn(
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    const key = `${init?.method ?? "GET"} ${url.pathname}`
    const route = routes[key]
    if (route) return route(init)
    if (url.pathname.startsWith("/api/v1/admin/media/"))
      return json(404, { error: { code: "NOT_FOUND", message: "x" } })
    return json(200, { items: [], page: 1, pageSize: 24, total: 0 })
  }
)

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
  routes = {
    "GET /api/v1/admin/pages/home": () => json(200, dto(1, home.hero.heading)),
  }
})

function renderEditor() {
  return render(
    <AdminShell
      queryClient={makeQueryClient()}
      session={{
        user: {
          id: "u1",
          name: "Edith",
          email: "e@x.test",
          title: null,
          twoFactorEnabled: true,
        },
        roles: ["editor"],
        impersonatedBy: null,
      }}
    >
      <PageEditor pageKey="home" />
    </AdminShell>
  )
}

async function headingInput() {
  const hero = await screen.findByRole("region", { name: "Hero" })
  return within(hero).getByRole("textbox", { name: "Heading" })
}

describe("page editor (master 4.4)", () => {
  it("saves with ⌘S and shows Saved", async () => {
    const user = userEvent.setup()
    const put = vi.fn((init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        draft: PageDto["draft"]
        version: number
      }
      expect(body.version).toBe(1)
      return json(200, { ...dto(2, "New heading"), draft: body.draft })
    })
    routes["PUT /api/v1/admin/pages/home/draft"] = put
    renderEditor()
    const heading = await headingInput()
    await user.clear(heading)
    await user.type(heading, "New heading")
    expect(
      screen.getByRole("status", { name: /^Save status/ })
    ).toHaveTextContent("Unsaved changes")
    await user.keyboard("{Control>}s{/Control}")
    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: /^Save status/ })
      ).toHaveTextContent("Saved")
    )
    expect(put).toHaveBeenCalledTimes(1)
  })

  it("shows the conflict dialog on 409 and reloads their version", async () => {
    const user = userEvent.setup()
    routes["PUT /api/v1/admin/pages/home/draft"] = () =>
      json(409, {
        error: {
          code: "CONFLICT",
          message: "Changed",
          current: dto(5, "Their heading"),
          requestId: "r",
        },
      })
    renderEditor()
    const heading = await headingInput()
    await user.type(heading, " mine")
    await user.keyboard("{Control>}s{/Control}")
    const dialog = await screen.findByRole("alertdialog", {
      name: "Someone else changed this",
    })
    expect(dialog).toHaveTextContent("Other Editor")
    await user.click(
      within(dialog).getByRole("button", { name: "Reload their version" })
    )
    await waitFor(async () =>
      expect(await headingInput()).toHaveValue("Their heading")
    )
    expect(
      screen.getByRole("status", { name: /^Save status/ })
    ).toHaveTextContent("Saved")
  })

  it("lists the changes before publishing and publishes with the saved version", async () => {
    const user = userEvent.setup()
    routes["PUT /api/v1/admin/pages/home/draft"] = (init) => {
      const body = JSON.parse(String(init?.body)) as { draft: PageDto["draft"] }
      return json(200, { ...dto(2, "Fresh"), draft: body.draft })
    }
    const publish = vi.fn((init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({ version: 2 })
      const published = { ...home, hero: { ...home.hero, heading: "Fresh" } }
      return json(200, { ...dto(3, "Fresh", published), dirty: false })
    })
    routes["POST /api/v1/admin/pages/home/publish"] = publish
    renderEditor()
    const heading = await headingInput()
    await user.clear(heading)
    await user.type(heading, "Fresh")
    await user.click(screen.getByRole("button", { name: "Publish" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Publish changes?",
    })
    expect(
      within(dialog).getByRole("list", { name: "Changes" })
    ).toHaveTextContent("Hero › Heading")
    expect(
      within(dialog).getByRole("list", { name: "Changes" })
    ).toHaveTextContent("Fresh")
    await user.click(
      within(dialog).getByRole("button", { name: "Publish now" })
    )
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Publish changes?" })
      ).toBeNull()
    )
    expect(document.querySelector('[data-slot="badge"]')).toHaveTextContent(
      "Published"
    )
  })

  it("does not autosave the form's own normalization on open", async () => {
    // A stale composed stat value ("x" instead of "18+") is corrected by the
    // form on mount; that is the baseline, not an edit.
    const stale = {
      ...home,
      hero: {
        ...home.hero,
        stats: home.hero.stats.map((s, i) =>
          i === 0 ? { ...s, value: "x" } : s
        ),
      },
    }
    routes["GET /api/v1/admin/pages/home"] = () =>
      json(200, { ...dto(1, home.hero.heading), draft: stale })
    const put = vi.fn(() => json(200, dto(2, home.hero.heading)))
    routes["PUT /api/v1/admin/pages/home/draft"] = put
    renderEditor()
    const hero = await screen.findByRole("region", { name: "Hero" })
    await waitFor(() =>
      expect(
        within(hero).getAllByRole("textbox", { name: "Value" })[0]
      ).toHaveValue("18+")
    )
    await new Promise((r) => setTimeout(r, 1800))
    expect(put).not.toHaveBeenCalled()
    expect(
      screen.getByRole("status", { name: /^Save status/ })
    ).toHaveTextContent("Saved")
  })

  it("asks before leaving with unsaved changes", async () => {
    const user = userEvent.setup()
    const confirm = vi.fn(() => false)
    vi.stubGlobal("confirm", confirm)
    renderEditor()
    const heading = await headingInput()
    await user.clear(heading)
    expect(
      screen.getByRole("status", { name: /^Save status/ })
    ).toHaveTextContent("Fix errors to save")
    await user.click(
      within(screen.getByRole("navigation", { name: "Admin" })).getByRole(
        "link",
        { name: "Services" }
      )
    )
    expect(confirm).toHaveBeenCalledTimes(1)
  })
})
