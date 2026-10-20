import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/insights/x",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import { ArticleEditor } from "@/components/admin/articles/article-editor"
import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { Role } from "@/lib/auth/roles"
import type { ArticleDto, ArticlePermissions } from "@/lib/schemas/api/articles"
import { articlesFixture } from "@/server/db/seed/fixtures/articles"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"

const ID = "0190f0e0-0000-7000-8000-0000000000a1"
const seeded = articlesFixture(fixtureMediaLookup).find((a) => a.content.body)!
const AUTHOR: ArticlePermissions = {
  update: true,
  delete: true,
  submit: true,
  publish: false,
  changeAuthor: false,
}
const EDITOR: ArticlePermissions = {
  update: true,
  delete: true,
  submit: true,
  publish: true,
  changeAuthor: true,
}

const dto = (over: Partial<ArticleDto> = {}): ArticleDto => ({
  id: ID,
  slug: "night-patrols",
  title: "Night Patrols",
  live: false,
  category: { id: "c1", slug: "mobile-patrols", name: "Mobile Patrols" },
  author: { id: "u1", name: "Arthur Author", title: null },
  scheduledAt: null,
  readTimeMinutes: null,
  createdAt: "2026-10-16T09:00:00.000Z",
  permissions: AUTHOR,
  draft: { ...seeded.content, title: "Night Patrols" },
  published: null,
  version: 1,
  status: "draft",
  dirty: true,
  publishedAt: null,
  updatedAt: "2026-10-16T09:00:00.000Z",
  updatedBy: { id: "u1", name: "Arthur Author" },
  ...over,
})

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

let routes: Record<string, (init?: RequestInit) => Response>
const calls: { key: string; body: unknown }[] = []

beforeEach(() => {
  calls.length = 0
  routes = {
    [`GET /api/v1/admin/articles/${ID}`]: () => json(200, dto()),
    "GET /api/v1/admin/articles/options": () =>
      json(200, {
        categories: [
          { id: "c1", slug: "mobile-patrols", name: "Mobile Patrols" },
        ],
        authors: [],
        featured: [],
      }),
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost")
      const key = `${init?.method ?? "GET"} ${url.pathname}`
      calls.push({
        key,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      })
      const route = routes[key]
      if (route) return route(init)
      if (url.pathname.startsWith("/api/v1/admin/media/"))
        return json(404, { error: { code: "NOT_FOUND", message: "x" } })
      return json(200, { items: [], page: 1, pageSize: 24, total: 0 })
    })
  )
})

function renderEditor(roles: Role[]) {
  return render(
    <AdminShell
      queryClient={makeQueryClient()}
      session={{
        user: {
          id: "u1",
          name: "Arthur Author",
          email: "a@example.test",
          title: null,
          twoFactorEnabled: true,
        },
        roles,
        impersonatedBy: null,
      }}
    >
      <ArticleEditor id={ID} />
    </AdminShell>
  )
}

const badge = () =>
  screen.getByRole("main").querySelector('[data-slot="status-pill"]')

describe("article editor (master 5.3)", () => {
  it("author: Submit for review saves first and sends the new version; no Publish or Schedule", async () => {
    const user = userEvent.setup()
    routes[`PUT /api/v1/admin/articles/${ID}/draft`] = (init) => {
      const body = JSON.parse(String(init?.body)) as {
        draft: ArticleDto["draft"]
      }
      return json(
        200,
        dto({ version: 2, draft: body.draft, title: body.draft.title })
      )
    }
    routes[`POST /api/v1/admin/articles/${ID}/submit`] = () =>
      json(
        200,
        dto({ version: 3, status: "in_review", title: "Night Patrols 2" })
      )
    renderEditor(["author"])
    const title = await screen.findByRole("textbox", { name: "Title" })
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Schedule" })).toBeNull()
    await user.type(title, " 2")
    await user.click(screen.getByRole("button", { name: "Submit for review" }))
    await waitFor(() => expect(badge()).toHaveTextContent("In review"))
    const keys = calls.map((c) => c.key)
    const put = keys.indexOf(`PUT /api/v1/admin/articles/${ID}/draft`)
    const submit = keys.indexOf(`POST /api/v1/admin/articles/${ID}/submit`)
    expect(put).toBeGreaterThan(-1)
    expect(submit).toBeGreaterThan(put)
    expect(calls[submit].body).toEqual({ version: 2 })
  })

  it("editor: Schedule takes Irish time and posts the UTC instant", async () => {
    const user = userEvent.setup()
    routes[`GET /api/v1/admin/articles/${ID}`] = () =>
      json(200, dto({ permissions: EDITOR }))
    routes[`POST /api/v1/admin/articles/${ID}/schedule`] = (init) => {
      const body = JSON.parse(String(init?.body)) as { scheduledAt: string }
      return json(
        200,
        dto({
          permissions: EDITOR,
          version: 2,
          status: "scheduled",
          scheduledAt: body.scheduledAt,
        })
      )
    }
    renderEditor(["editor"])
    await user.click(await screen.findByRole("button", { name: "Schedule" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Schedule publishing",
    })
    fireEvent.change(within(dialog).getByLabelText("Publish on"), {
      target: { value: "2099-07-01T10:00" },
    })
    await user.click(within(dialog).getByRole("button", { name: "Schedule" }))
    await waitFor(() => expect(badge()).toHaveTextContent(/^Scheduled · /))
    const post = calls.find(
      (c) => c.key === `POST /api/v1/admin/articles/${ID}/schedule`
    )
    expect(post?.body).toEqual({
      version: 1,
      scheduledAt: "2099-07-01T09:00:00.000Z",
    })
    expect(
      screen.getByRole("button", { name: "Cancel schedule" })
    ).toBeInTheDocument()
  })

  it("opens read-only when the user may not change the article", async () => {
    routes[`GET /api/v1/admin/articles/${ID}`] = () =>
      json(
        200,
        dto({
          live: true,
          status: "published",
          published: dto().draft,
          dirty: false,
          publishedAt: "2026-10-16T10:00:00.000Z",
          permissions: {
            ...AUTHOR,
            update: false,
            delete: false,
            submit: false,
          },
        })
      )
    renderEditor(["author"])
    expect(await screen.findByRole("textbox", { name: "Title" })).toBeDisabled()
    expect(screen.queryByRole("status", { name: /^Save status/ })).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Submit for review" })
    ).toBeNull()
    expect(screen.queryByRole("button", { name: "Delete article" })).toBeNull()
    expect(screen.getByLabelText("Address")).toBeDisabled()
    // Says why (an author's article is locked once it is on the site).
    expect(screen.getByRole("main")).toHaveTextContent(
      "It is on the site: only an editor can change it now."
    )
  })

  const live = (over: Partial<ArticleDto> = {}) =>
    dto({
      live: true,
      status: "published",
      published: dto().draft,
      dirty: false,
      publishedAt: "2026-10-16T10:00:00.000Z",
      permissions: EDITOR,
      ...over,
    })

  it("editor: unpublishes a live article after confirming", async () => {
    const user = userEvent.setup()
    routes[`GET /api/v1/admin/articles/${ID}`] = () => json(200, live())
    routes[`POST /api/v1/admin/articles/${ID}/unpublish`] = () =>
      json(200, dto({ permissions: EDITOR, version: 2 }))
    renderEditor(["editor"])
    await waitFor(() => expect(badge()).toHaveTextContent("Published"))
    await user.click(await screen.findByRole("button", { name: "Unpublish" }))
    const confirm = await screen.findByRole("alertdialog", {
      name: "Unpublish Night Patrols?",
    })
    await user.click(within(confirm).getByRole("button", { name: "Unpublish" }))
    await waitFor(() => expect(badge()).toHaveTextContent("Draft"))
    const post = calls.find(
      (c) => c.key === `POST /api/v1/admin/articles/${ID}/unpublish`
    )
    expect(post?.body).toEqual({ version: 1 })
  })

  it("editor: the blog's featured article cannot be unpublished, deleted or moved, and says why", async () => {
    routes[`GET /api/v1/admin/articles/${ID}`] = () => json(200, live())
    routes["GET /api/v1/admin/articles/options"] = () =>
      json(200, {
        categories: [
          { id: "c1", slug: "mobile-patrols", name: "Mobile Patrols" },
        ],
        authors: [],
        featured: ["night-patrols"],
      })
    renderEditor(["editor"])
    const why = await screen.findByText(/The blog page features this article\./)
    const unpublish = await screen.findByRole("button", { name: "Unpublish" })
    expect(unpublish).toBeDisabled()
    expect(unpublish).toHaveAccessibleDescription(why.textContent!)
    expect(
      screen.getByRole("button", { name: "Delete article" })
    ).toBeDisabled()
    expect(screen.getByLabelText("Address")).toBeDisabled()
    // Everything else stays open: the text, the schedule, the category.
    expect(screen.getByRole("textbox", { name: "Title" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Schedule" })).toBeEnabled()
    expect(screen.getByLabelText("Category")).toBeEnabled()
  })

  it("shows a live article's pending workflow step beside Published", async () => {
    routes[`GET /api/v1/admin/articles/${ID}`] = () =>
      json(
        200,
        live({
          status: "scheduled",
          dirty: true,
          scheduledAt: "2099-07-01T09:00:00.000Z",
        })
      )
    renderEditor(["editor"])
    await waitFor(() => expect(badge()).toHaveTextContent("Published"))
    const pills = [
      ...screen
        .getByRole("main")
        .querySelectorAll('[data-slot="editor-bar"] [data-slot="status-pill"]'),
    ].map((pill) => pill.textContent)
    expect(pills).toEqual(["Published", "Scheduled · 1 Jul 2099, 10:00"])
    expect(screen.getByRole("button", { name: "Reschedule" })).toBeEnabled()
    expect(
      screen.getByRole("button", { name: "Cancel schedule" })
    ).toBeEnabled()
  })

  describe("fix round 1: stale versions, schedule errors, settings save", () => {
    const conflict = (current: ArticleDto) =>
      json(409, {
        error: { code: "CONFLICT", message: "Changed meanwhile", current },
      })
    const theirs = dto({
      permissions: EDITOR,
      version: 5,
      status: "in_review",
      title: "Their title",
      draft: { ...dto().draft, title: "Their title" },
    })

    it("a 409 on Schedule takes their version (header, form); a retry sends it", async () => {
      const user = userEvent.setup()
      routes[`GET /api/v1/admin/articles/${ID}`] = () =>
        json(200, dto({ permissions: EDITOR }))
      let attempts = 0
      routes[`POST /api/v1/admin/articles/${ID}/schedule`] = (init) => {
        attempts += 1
        if (attempts === 1) return conflict(theirs)
        const body = JSON.parse(String(init?.body)) as { scheduledAt: string }
        return json(
          200,
          dto({
            permissions: EDITOR,
            version: 6,
            status: "scheduled",
            scheduledAt: body.scheduledAt,
          })
        )
      }
      renderEditor(["editor"])
      const schedule = async () => {
        await user.click(
          await screen.findByRole("button", { name: "Schedule" })
        )
        const dialog = await screen.findByRole("dialog", {
          name: "Schedule publishing",
        })
        fireEvent.change(within(dialog).getByLabelText("Publish on"), {
          target: { value: "2099-07-01T10:00" },
        })
        await user.click(
          within(dialog).getByRole("button", { name: "Schedule" })
        )
      }
      await schedule()
      expect(
        await screen.findByText(
          "Someone else changed this article — it now shows their version."
        )
      ).toBeInTheDocument()
      await waitFor(() => expect(badge()).toHaveTextContent("In review"))
      expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue(
        "Their title"
      )
      expect(
        screen.queryByRole("dialog", { name: "Schedule publishing" })
      ).toBeNull()
      await schedule()
      await waitFor(() => expect(badge()).toHaveTextContent(/^Scheduled · /))
      const posts = calls.filter(
        (c) => c.key === `POST /api/v1/admin/articles/${ID}/schedule`
      )
      expect(posts.map((c) => (c.body as { version: number }).version)).toEqual(
        [1, 5]
      )
    })

    it("a 409 on Save settings takes their version; a retry sends it", async () => {
      const user = userEvent.setup()
      routes[`GET /api/v1/admin/articles/${ID}`] = () =>
        json(200, dto({ permissions: EDITOR }))
      let attempts = 0
      routes[`PATCH /api/v1/admin/articles/${ID}/meta`] = (init) => {
        attempts += 1
        if (attempts === 1) return conflict(theirs)
        const body = JSON.parse(String(init?.body)) as { slug: string }
        return json(
          200,
          dto({ permissions: EDITOR, version: 6, slug: body.slug })
        )
      }
      renderEditor(["editor"])
      const address = await screen.findByLabelText("Address")
      await user.clear(address)
      await user.type(address, "night-patrols-2")
      await user.click(screen.getByRole("button", { name: "Save settings" }))
      expect(
        await screen.findByText(
          "Someone else changed this article — it now shows their version."
        )
      ).toBeInTheDocument()
      await waitFor(() => expect(badge()).toHaveTextContent("In review"))
      // Their record did not change the address: the edit is kept for a retry.
      await user.click(screen.getByRole("button", { name: "Save settings" }))
      expect(await screen.findByText("Settings saved")).toBeInTheDocument()
      const patches = calls.filter(
        (c) => c.key === `PATCH /api/v1/admin/articles/${ID}/meta`
      )
      expect(patches.map((c) => c.body)).toEqual([
        { version: 1, slug: "night-patrols-2" },
        { version: 5, slug: "night-patrols-2" },
      ])
    })

    it("a 409 on Delete takes their version and stays on the article", async () => {
      const user = userEvent.setup()
      routes[`GET /api/v1/admin/articles/${ID}`] = () =>
        json(200, dto({ permissions: EDITOR }))
      routes[`DELETE /api/v1/admin/articles/${ID}`] = () => conflict(theirs)
      renderEditor(["editor"])
      await user.click(
        await screen.findByRole("button", { name: "Delete article" })
      )
      const confirm = await screen.findByRole("alertdialog")
      await user.click(
        within(confirm).getByRole("button", { name: "Delete article" })
      )
      expect(
        await screen.findByText(
          "Someone else changed this article — it now shows their version."
        )
      ).toBeInTheDocument()
      await waitFor(() => expect(badge()).toHaveTextContent("In review"))
    })

    it("shows the server's schedule-time error inside the dialog", async () => {
      const user = userEvent.setup()
      routes[`GET /api/v1/admin/articles/${ID}`] = () =>
        json(200, dto({ permissions: EDITOR }))
      routes[`POST /api/v1/admin/articles/${ID}/schedule`] = () =>
        json(422, {
          error: {
            code: "VALIDATION_FAILED",
            message: "Choose a time in the future",
            fieldErrors: { scheduledAt: ["Choose a time in the future"] },
          },
        })
      renderEditor(["editor"])
      await user.click(await screen.findByRole("button", { name: "Schedule" }))
      const dialog = await screen.findByRole("dialog", {
        name: "Schedule publishing",
      })
      fireEvent.change(within(dialog).getByLabelText("Publish on"), {
        target: { value: "2099-07-01T10:00" },
      })
      await user.click(within(dialog).getByRole("button", { name: "Schedule" }))
      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "Choose a time in the future"
      )
      expect(within(dialog).getByLabelText("Publish on")).toHaveAttribute(
        "aria-invalid",
        "true"
      )
    })

    it("an invalid draft marks its fields instead of opening the Schedule dialog", async () => {
      const user = userEvent.setup()
      routes[`GET /api/v1/admin/articles/${ID}`] = () =>
        json(200, dto({ permissions: EDITOR }))
      renderEditor(["editor"])
      const title = await screen.findByRole("textbox", { name: "Title" })
      await user.clear(title)
      await user.click(screen.getByRole("button", { name: "Schedule" }))
      expect(
        screen.queryByRole("dialog", { name: "Schedule publishing" })
      ).toBeNull()
      await waitFor(() => expect(title).toHaveAttribute("aria-invalid", "true"))
    })

    it("Save settings does not report success when the pending text could not be saved", async () => {
      const user = userEvent.setup()
      routes[`GET /api/v1/admin/articles/${ID}`] = () =>
        json(200, dto({ permissions: EDITOR }))
      routes[`PUT /api/v1/admin/articles/${ID}/draft`] = () =>
        json(500, { error: { code: "INTERNAL", message: "Boom" } })
      renderEditor(["editor"])
      await user.type(
        await screen.findByRole("textbox", { name: "Title" }),
        " 2"
      )
      const address = screen.getByLabelText("Address")
      await user.clear(address)
      await user.type(address, "night-patrols-2")
      // Toasts outlive a test (sonner's store): count, do not assert absence.
      const saved = screen.queryAllByText("Settings saved").length
      await user.click(screen.getByRole("button", { name: "Save settings" }))
      expect(await screen.findByText(/could not be saved/)).toBeInTheDocument()
      expect(screen.queryAllByText("Settings saved")).toHaveLength(saved)
      expect(
        calls.some((c) => c.key === `PATCH /api/v1/admin/articles/${ID}/meta`)
      ).toBe(false)
    })
  })
})
