import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { push, replace, search } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  search: { current: new URLSearchParams() },
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/articles",
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  useSearchParams: () => search.current,
}))

import { ArticlesScreen } from "@/components/admin/articles/articles-screen"
import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { Role } from "@/lib/auth/roles"
import type {
  ArticleListItem,
  ArticleOptions,
} from "@/lib/schemas/api/articles"

import { optionLabels, pickOption } from "./select-helper"

const item = (
  over: Partial<ArticleListItem> & Pick<ArticleListItem, "id" | "title">
): ArticleListItem => ({
  slug: over.id,
  live: false,
  category: { id: "c1", slug: "mobile-patrols", name: "Mobile Patrols" },
  author: { id: "u2", name: "Arthur Author", title: null },
  scheduledAt: null,
  readTimeMinutes: null,
  createdAt: "2026-10-16T09:00:00.000Z",
  permissions: {
    update: true,
    delete: true,
    submit: false,
    publish: true,
    changeAuthor: true,
  },
  version: 1,
  status: "draft",
  dirty: true,
  publishedAt: null,
  updatedAt: "2026-10-16T09:00:00.000Z",
  updatedBy: null,
  ...over,
})

const ITEMS = [
  item({ id: "draft-one", title: "Draft one" }),
  item({ id: "review-me", title: "Review me", status: "in_review" }),
]

let options: ArticleOptions
/** Overrides for the list mock: its rows and the reported total. */
let listItems: ArticleListItem[] | undefined
let total: number | undefined
const listCalls: URL[] = []
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  })

beforeEach(() => {
  push.mockReset()
  replace.mockReset()
  listCalls.length = 0
  listItems = undefined
  total = undefined
  search.current = new URLSearchParams()
  options = {
    categories: [
      { id: "c1", slug: "mobile-patrols", name: "Mobile Patrols" },
      { id: "c2", slug: "company-news", name: "Company News" },
    ],
    authors: [{ id: "u1", name: "Edith Editor", title: null }],
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost")
      if (url.pathname === "/api/v1/admin/articles/options")
        return json(options)
      if (url.pathname === "/api/v1/admin/articles") {
        listCalls.push(url)
        const status = url.searchParams.get("status")
        const items = (listItems ?? ITEMS).filter(
          (i) => !status || i.status === status
        )
        const page = Number(url.searchParams.get("page") ?? "1")
        return json({ items, page, pageSize: 20, total: total ?? items.length })
      }
      return json({ items: [], page: 1, pageSize: 24, total: 0 })
    })
  )
})

function renderScreen(roles: Role[] = ["editor"]) {
  return render(
    <AdminShell
      queryClient={makeQueryClient()}
      session={{
        user: {
          id: "u1",
          name: "Edith Editor",
          email: "e@example.test",
          title: null,
          twoFactorEnabled: true,
        },
        roles,
        impersonatedBy: null,
      }}
    >
      <ArticlesScreen />
    </AdminShell>
  )
}

describe("articles list (master 5.3)", () => {
  it("opens the review queue from ?status=in_review and switches back to all", async () => {
    const user = userEvent.setup()
    search.current = new URLSearchParams("status=in_review")
    renderScreen()
    const table = await screen.findByRole("table", { name: "Articles" })
    expect(within(table).getByText("Review me")).toBeInTheDocument()
    expect(within(table).queryByText("Draft one")).toBeNull()
    expect(within(table).getByText("In review")).toBeInTheDocument()
    expect(listCalls.at(-1)?.searchParams.get("status")).toBe("in_review")
    expect(listCalls.at(-1)?.searchParams.get("sort")).toBe("updatedAt:desc")
    const queue = screen.getByRole("button", { name: "Review queue" })
    expect(queue).toHaveAttribute("aria-pressed", "true")
    await user.click(screen.getByRole("button", { name: "All" }))
    expect(replace).toHaveBeenCalledWith("/admin/articles", { scroll: false })
  })

  it("filters by category and byline", async () => {
    const user = userEvent.setup()
    total = 45 // three pages, so a filter change can send the list back to 1
    renderScreen()
    await screen.findByRole("table", { name: "Articles" })
    await user.click(screen.getByRole("button", { name: "Next page" }))
    await waitFor(() =>
      expect(listCalls.at(-1)?.searchParams.get("page")).toBe("2")
    )
    const category = screen.getByRole("combobox", { name: "Category" })
    // The trigger shows the label once the options have loaded.
    await waitFor(() => expect(category).toHaveTextContent("All categories"))
    await pickOption(user, category, "Company News")
    expect(category).toHaveTextContent("Company News")
    await waitFor(() =>
      expect(listCalls.at(-1)?.searchParams.get("category")).toBe("c2")
    )
    expect(listCalls.at(-1)?.searchParams.get("page")).toBe("1")
    const byline = screen.getByRole("combobox", { name: "Byline" })
    expect(await optionLabels(user, byline)).toEqual([
      "Anyone",
      "Me",
      "Edith Editor",
    ])
    await pickOption(user, byline, "Me")
    await waitFor(() =>
      expect(listCalls.at(-1)?.searchParams.get("author")).toBe("me")
    )
  })

  it("authors get New article and their own filter; viewers only read", async () => {
    const user = userEvent.setup()
    options = { ...options, authors: [] }
    const { unmount } = renderScreen(["author"])
    await screen.findByRole("table", { name: "Articles" })
    expect(screen.getByRole("link", { name: "New article" })).toHaveAttribute(
      "href",
      "/admin/articles/new"
    )
    expect(screen.queryByRole("button", { name: "Review queue" })).toBeNull()
    expect(
      screen.getByRole("button", { name: "In review" })
    ).toBeInTheDocument()
    expect(
      await optionLabels(user, screen.getByRole("combobox", { name: "Byline" }))
    ).toEqual(["Anyone", "Me"])
    unmount()
    renderScreen(["viewer"])
    await screen.findByRole("table", { name: "Articles" })
    expect(screen.queryByRole("link", { name: "New article" })).toBeNull()
  })

  it("tells an empty list from an empty review queue", async () => {
    listItems = []
    const { unmount } = renderScreen()
    expect(await screen.findByText("No articles yet")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Articles appear on /blog once published. Drafts stay private until then."
      )
    ).toBeInTheDocument()
    unmount()
    search.current = new URLSearchParams("status=in_review")
    renderScreen()
    expect(
      await screen.findByText("Nothing is waiting for review")
    ).toBeInTheDocument()
    expect(screen.queryByText("No articles yet")).toBeNull()
  })

  it("names other filters' empty result generically", async () => {
    listItems = []
    search.current = new URLSearchParams("status=draft")
    renderScreen()
    expect(
      await screen.findByText("No articles match these filters")
    ).toBeInTheDocument()
    expect(screen.queryByText("Nothing is waiting for review")).toBeNull()
  })
})
