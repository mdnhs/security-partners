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

let routes: Record<string, (init?: RequestInit) => Response | Promise<Response>>
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
  window.history.replaceState(null, "", "/admin/pages/home")
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
    const header = document.querySelector('[data-slot="editor-bar"]')!
    expect(
      [...header.querySelectorAll('[data-slot="status-pill"]')].map(
        (pill) => pill.textContent
      )
    ).toEqual(["Published"])
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
  const saveStatus = () => screen.getByRole("status", { name: /^Save status/ })
  const conflictBody = (heading: string) => ({
    error: {
      code: "CONFLICT",
      message: "Changed",
      current: dto(5, heading),
      requestId: "r",
    },
  })
  type PutBody = { draft: { hero: { heading: string } }; version: number }
  const bodyOf = (init?: RequestInit) =>
    JSON.parse(String(init?.body)) as PutBody

  /** A PUT that answers only when `release()` is called. */
  function deferredPut() {
    const bodies: PutBody[] = []
    let release: () => void = () => undefined
    routes["PUT /api/v1/admin/pages/home/draft"] = (init) => {
      const body = bodyOf(init)
      bodies.push(body)
      return new Promise<Response>((resolve) => {
        release = () =>
          resolve(
            json(200, {
              ...dto(body.version + 1, body.draft.hero.heading),
              draft: body.draft,
            })
          )
      })
    }
    return { bodies, release: () => release() }
  }

  function publishRoute() {
    const versions: number[] = []
    routes["POST /api/v1/admin/pages/home/publish"] = (init) => {
      const { version } = JSON.parse(String(init?.body)) as { version: number }
      versions.push(version)
      if (version !== 2) return json(409, conflictBody("Stale publish"))
      const published = { ...home, hero: { ...home.hero, heading: "Queued" } }
      return json(200, { ...dto(3, "Queued", published), dirty: false })
    }
    return versions
  }

  it("a 409 from publish closes the publish dialog and opens the conflict dialog", async () => {
    const user = userEvent.setup()
    routes["POST /api/v1/admin/pages/home/publish"] = () =>
      json(409, conflictBody("Their heading"))
    renderEditor()
    await headingInput()
    await user.click(screen.getByRole("button", { name: "Publish" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Publish changes?",
    })
    await user.click(
      within(dialog).getByRole("button", { name: "Publish now" })
    )
    const conflict = await screen.findByRole("alertdialog", {
      name: "Someone else changed this",
    })
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", {
          name: "Publish changes?",
          hidden: true,
        })
      ).toBeNull()
    )
    await user.click(
      within(conflict).getByRole("button", { name: "Reload their version" })
    )
    await waitFor(async () =>
      expect(await headingInput()).toHaveValue("Their heading")
    )
  })

  it("a 409 on the pre-publish save closes the publish dialog (conflict dialog only)", async () => {
    const user = userEvent.setup()
    routes["PUT /api/v1/admin/pages/home/draft"] = () =>
      json(409, conflictBody("Their heading"))
    const publish = vi.fn(() => json(200, dto(9, "x")))
    routes["POST /api/v1/admin/pages/home/publish"] = publish
    renderEditor()
    const heading = await headingInput()
    await user.type(heading, " mine")
    await user.click(screen.getByRole("button", { name: "Publish" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Publish changes?",
    })
    await user.click(
      within(dialog).getByRole("button", { name: "Publish now" })
    )
    await screen.findByRole("alertdialog", {
      name: "Someone else changed this",
    })
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", {
          name: "Publish changes?",
          hidden: true,
        })
      ).toBeNull()
    )
    expect(publish).not.toHaveBeenCalled()
  })

  it("publishing during an in-flight autosave waits for it: one PUT, then publish with its version", async () => {
    const user = userEvent.setup()
    const put = deferredPut()
    const versions = publishRoute()
    renderEditor()
    const heading = await headingInput()
    await user.clear(heading)
    await user.type(heading, "Queued")
    await waitFor(() => expect(saveStatus()).toHaveTextContent("Saving…"), {
      timeout: 3000,
    })
    await user.click(screen.getByRole("button", { name: "Publish" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Publish changes?",
    })
    await user.click(
      within(dialog).getByRole("button", { name: "Publish now" })
    )
    put.release()
    await waitFor(() => expect(versions).toEqual([2]))
    expect(put.bodies).toHaveLength(1)
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Publish changes?" })
      ).toBeNull()
    )
    expect(screen.queryByRole("alertdialog")).toBeNull()
  })

  it("⌘S twice and Publish during one in-flight save: one PUT, no self-409", async () => {
    const user = userEvent.setup()
    const put = deferredPut()
    const versions = publishRoute()
    renderEditor()
    const heading = await headingInput()
    await user.clear(heading)
    await user.type(heading, "Queued")
    await user.keyboard("{Control>}s{/Control}")
    await user.keyboard("{Meta>}s{/Meta}")
    expect(saveStatus()).toHaveTextContent("Saving…")
    await user.click(screen.getByRole("button", { name: "Publish" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Publish changes?",
    })
    await user.click(
      within(dialog).getByRole("button", { name: "Publish now" })
    )
    put.release()
    await waitFor(() => expect(versions).toEqual([2]))
    expect(put.bodies).toHaveLength(1)
    expect(put.bodies[0].version).toBe(1)
    expect(screen.queryByRole("alertdialog")).toBeNull()
    await waitFor(() => expect(saveStatus()).toHaveTextContent("Saved"))
  })

  it("overwrite with mine re-sends my draft with their version", async () => {
    const user = userEvent.setup()
    const bodies: PutBody[] = []
    routes["PUT /api/v1/admin/pages/home/draft"] = (init) => {
      const body = bodyOf(init)
      bodies.push(body)
      if (body.version !== 5) return json(409, conflictBody("Their heading"))
      return json(200, {
        ...dto(6, body.draft.hero.heading),
        draft: body.draft,
      })
    }
    renderEditor()
    const heading = await headingInput()
    await user.type(heading, " mine")
    await user.keyboard("{Control>}s{/Control}")
    const dialog = await screen.findByRole("alertdialog", {
      name: "Someone else changed this",
    })
    await user.click(
      within(dialog).getByRole("button", { name: "Overwrite with mine" })
    )
    await waitFor(() => expect(bodies).toHaveLength(2))
    expect(bodies[1].version).toBe(5)
    expect(bodies[1].draft.hero.heading).toBe(`${home.hero.heading} mine`)
    await waitFor(() => expect(saveStatus()).toHaveTextContent("Saved"))
    expect(heading).toHaveValue(`${home.hero.heading} mine`)
    expect(screen.queryByRole("alertdialog")).toBeNull()
  })

  it("copy mine puts my draft on the clipboard, then loads theirs", async () => {
    const user = userEvent.setup()
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined)
    routes["PUT /api/v1/admin/pages/home/draft"] = () =>
      json(409, conflictBody("Their heading"))
    renderEditor()
    const heading = await headingInput()
    await user.type(heading, " mine")
    await user.keyboard("{Control>}s{/Control}")
    const dialog = await screen.findByRole("alertdialog", {
      name: "Someone else changed this",
    })
    await user.click(
      within(dialog).getByRole("button", { name: "Copy mine, then reload" })
    )
    await waitFor(async () =>
      expect(await headingInput()).toHaveValue("Their heading")
    )
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText.mock.calls[0][0]).toContain(`${home.hero.heading} mine`)
    expect(saveStatus()).toHaveTextContent("Saved")
  })
})

describe("page editor section tabs", () => {
  it("shows one template group per tab and keeps edits across tabs", async () => {
    const user = userEvent.setup()
    const put = vi.fn((init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { draft: typeof home }
      return json(200, {
        ...dto(2, body.draft.hero.heading),
        draft: body.draft,
      })
    })
    routes["PUT /api/v1/admin/pages/home/draft"] = put
    renderEditor()
    const heading = await headingInput()
    const tablist = screen.getByRole("tablist", { name: "Sections" })
    // A page has a parent list: the header links back to it.
    expect(screen.getByRole("link", { name: "All pages" })).toHaveAttribute(
      "href",
      "/admin/pages"
    )
    // The sticky tab rail stops below the editor's sticky bar.
    expect(
      tablist
        .closest<HTMLElement>("[style]")
        ?.style.getPropertyValue("--section-tabs-top")
    ).toMatch(/^\d+px$/)
    expect(
      within(tablist)
        .getAllByRole("tab")
        .map((tab) => tab.textContent)
    ).toEqual(["Hero", "Services section", "Team section", "Blog section"])
    expect(within(tablist).getByRole("tab", { name: "Hero" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    expect(screen.queryByRole("region", { name: "Team section" })).toBeNull()

    await user.clear(heading)
    await user.type(heading, "Kept heading")
    await user.click(within(tablist).getByRole("tab", { name: "Team section" }))
    expect(window.location.search).toBe("?tab=team")
    expect(screen.getByRole("region", { name: "Team section" })).toBeVisible()
    expect(screen.queryByRole("region", { name: "Hero" })).toBeNull()
    await user.click(within(tablist).getByRole("tab", { name: "Hero" }))
    expect(await headingInput()).toHaveValue("Kept heading")

    // The hidden groups still belong to the draft that is saved.
    await user.keyboard("{Control>}s{/Control}")
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    const sent = JSON.parse(String(put.mock.calls[0][0]?.body)) as {
      draft: typeof home
    }
    expect(sent.draft.hero.heading).toBe("Kept heading")
    expect(sent.draft.team).toEqual(home.team)
  })

  it("marks tabs with errors and jumps to the first one on publish", async () => {
    const user = userEvent.setup()
    const push = vi.spyOn(window.history, "pushState")
    renderEditor()
    const heading = await headingInput()
    await user.clear(heading)
    const tablist = screen.getByRole("tablist", { name: "Sections" })
    await user.click(within(tablist).getByRole("tab", { name: "Blog section" }))
    await user.click(screen.getByRole("button", { name: "Publish" }))
    const hero = await within(tablist).findByRole("tab", {
      name: "Hero, has errors",
    })
    expect(hero).toHaveAttribute("aria-selected", "true")
    expect(
      within(tablist).getByRole("tab", { name: "Blog section" })
    ).toHaveAttribute("aria-selected", "false")
    expect(await headingInput()).toHaveAttribute("aria-invalid", "true")
    // The jump lands on the first invalid field and replaces the history
    // entry (it was not a click).
    await waitFor(async () => expect(await headingInput()).toHaveFocus())
    expect(window.location.search).toBe("?tab=hero")
    expect(push).toHaveBeenCalledTimes(1) // the click on "Blog section"
    push.mockRestore()
    expect(
      screen.queryByRole("dialog", { name: "Publish changes?" })
    ).toBeNull()
  })
})
