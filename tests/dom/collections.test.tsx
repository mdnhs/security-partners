import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { push, replace, search } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  search: { current: new URLSearchParams() },
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/categories",
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  useSearchParams: () => search.current,
}))

import { CollectionScreen } from "@/components/admin/collections/collection-screen"
import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import { SortableList } from "@/components/admin/sortable-list"
import { slugify } from "@/components/admin/services/new-service-form"
import type { Role } from "@/lib/auth/roles"

const category = (i: number) => ({
  id: `00000000-0000-7000-8000-00000000000${i}`,
  slug: `cat-${i}`,
  name: `Category ${i}`,
  showInFilter: i % 2 === 0,
  sortOrder: i,
  updatedAt: "2026-10-16T09:00:00.000Z",
  articleCount: i,
})

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

const fetchMock = vi.fn()

beforeEach(() => {
  push.mockReset()
  replace.mockReset()
  search.current = new URLSearchParams()
  fetchMock.mockReset()
  fetchMock.mockImplementation(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost")
      const method = init?.method ?? "GET"
      if (method === "GET" && url.pathname === "/api/v1/admin/categories") {
        const page = Number(url.searchParams.get("page"))
        const items = page === 1 ? [category(1), category(2)] : [category(3)]
        return json(200, {
          items,
          page,
          pageSize: Number(url.searchParams.get("pageSize")),
          total: 3,
        })
      }
      if (method === "POST" && url.pathname === "/api/v1/admin/categories")
        return json(409, {
          error: {
            code: "CONFLICT",
            message: "Another category already uses this address",
            fieldErrors: { slug: ["Already used"] },
          },
        })
      return json(404, { error: { code: "NOT_FOUND", message: "x" } })
    }
  )
  vi.stubGlobal("fetch", fetchMock)
})

function renderScreen(roles: Role[] = ["editor"]) {
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
      <CollectionScreen name="categories" />
    </AdminShell>
  )
}

const lastUrl = () =>
  new URL(String(fetchMock.mock.calls.at(-1)![0]), "http://localhost")

describe("collection screen + data table (master 4.6)", () => {
  it("pages and sorts on the server and renders table rows and phone cards", async () => {
    const user = userEvent.setup()
    renderScreen()
    const table = await screen.findByRole("table", { name: "Categories" })
    expect(within(table).getAllByRole("row")).toHaveLength(3)
    expect(screen.getByRole("list", { name: "Categories" })).toBeInTheDocument()
    expect(lastUrl().searchParams.get("sort")).toBeNull()

    await user.click(within(table).getByRole("button", { name: /Name/ }))
    await waitFor(() =>
      expect(lastUrl().searchParams.get("sort")).toBe("name:asc")
    )
    expect(
      within(table).getByRole("columnheader", { name: /Name/ })
    ).toHaveAttribute("aria-sort", "ascending")

    const pager = screen.getByRole("navigation", { name: "Pagination" })
    expect(pager).toHaveTextContent("1–3 of 3")
    expect(within(pager).getByRole("button", { name: "Next" })).toBeDisabled()
  })

  it("searches with a debounced query", async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByRole("table", { name: "Categories" })
    await user.type(
      screen.getByRole("searchbox", { name: "Search categories" }),
      "news"
    )
    await waitFor(() => expect(lastUrl().searchParams.get("q")).toBe("news"))
  })

  it("shows the server's field error when creating a duplicate", async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByRole("table", { name: "Categories" })
    await user.click(screen.getByRole("button", { name: "Add category" }))
    const sheet = await screen.findByRole("dialog", { name: "Category" })
    await user.type(
      within(sheet).getByRole("textbox", { name: "Address" }),
      "cat-1"
    )
    await user.type(within(sheet).getByRole("textbox", { name: "Name" }), "Dup")
    await user.click(within(sheet).getByRole("button", { name: "Save" }))
    expect(await within(sheet).findByText("Already used")).toBeInTheDocument()
  })

  it("hides add/order buttons without permission", async () => {
    renderScreen(["viewer"])
    await screen.findByRole("table", { name: "Categories" })
    expect(screen.queryByRole("button", { name: "Add category" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Change order" })).toBeNull()
  })
})

describe("collection screen: reorder and ?edit (⌘K)", () => {
  it("loads every page for the reorder list (the API needs the full id set)", async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByRole("table", { name: "Categories" })
    await user.click(screen.getByRole("button", { name: "Change order" }))
    const list = await screen.findByRole("list", { name: "Categories order" })
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((li) => li.textContent)
    ).toEqual([
      expect.stringContaining("Category 1"),
      expect.stringContaining("Category 2"),
      expect.stringContaining("Category 3"),
    ])
    const pages = fetchMock.mock.calls
      .map(([input]) => new URL(String(input), "http://localhost"))
      .filter((url) => url.searchParams.get("sort") === "sortOrder:asc")
    expect(pages.map((url) => url.searchParams.get("page"))).toEqual(["1", "2"])
    expect(pages[0].searchParams.get("pageSize")).toBe("100")
  })

  it("opens the record named by ?edit=<id>", async () => {
    const target = category(2)
    search.current = new URLSearchParams(`edit=${target.id}`)
    const list = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input), "http://localhost")
        if (url.pathname === `/api/v1/admin/categories/${target.id}`)
          return json(200, target)
        return list(input, init)
      }
    )
    renderScreen()
    const sheet = await screen.findByRole("dialog", { name: "Category" })
    expect(within(sheet).getByRole("textbox", { name: "Name" })).toHaveValue(
      "Category 2"
    )
  })
})

const session = (roles: Role[]) => ({
  user: {
    id: "u",
    name: "U",
    email: "u@x.test",
    title: null,
    twoFactorEnabled: true,
  },
  roles,
  impersonatedBy: null,
})

/** Wraps the current fetch mock: `routes` answer first, the rest falls through. */
function route(
  routes: (
    url: URL,
    method: string,
    init?: RequestInit
  ) => Response | undefined | Promise<Response | undefined>
) {
  const fallback = fetchMock.getMockImplementation()!
  fetchMock.mockImplementation(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost")
      return (
        (await routes(url, init?.method ?? "GET", init)) ??
        fallback(input, init)
      )
    }
  )
}

describe("collection screen: empty state, paging edge, stale ?edit (fix round 1)", () => {
  const empty = () =>
    route((url, method) =>
      method === "GET" && url.pathname === "/api/v1/admin/categories"
        ? json(200, { items: [], page: 1, pageSize: 20, total: 0 })
        : undefined
    )

  it("offers an Add action in the empty state to editors", async () => {
    empty()
    const user = userEvent.setup()
    renderScreen()
    expect(await screen.findByText("No categories yet.")).toBeInTheDocument()
    const adds = screen.getAllByRole("button", { name: "Add category" })
    expect(adds).toHaveLength(2)
    await user.click(adds[1])
    expect(
      await screen.findByRole("dialog", { name: "Category" })
    ).toBeInTheDocument()
  })

  it("shows only the empty text to viewers", async () => {
    empty()
    renderScreen(["viewer"])
    expect(await screen.findByText("No categories yet.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Add category" })).toBeNull()
  })

  it("goes back to the last page when the current page comes back empty", async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      ...category(1),
      id: `00000000-0000-7000-8000-0000000001${String(i).padStart(2, "0")}`,
      name: `Item ${i}`,
    }))
    route((url, method) => {
      if (method !== "GET" || url.pathname !== "/api/v1/admin/categories")
        return undefined
      const page = Number(url.searchParams.get("page"))
      // Page 1 first reports 21 records; by the time page 2 loads one was deleted.
      return page === 1
        ? json(200, { items: many, page, pageSize: 20, total: 21 })
        : json(200, { items: [], page, pageSize: 20, total: 20 })
    })
    const user = userEvent.setup()
    renderScreen()
    await screen.findByRole("table", { name: "Categories" })
    const pager = screen.getByRole("navigation", { name: "Pagination" })
    await user.click(within(pager).getByRole("button", { name: "Next" }))
    const pagesAsked = () =>
      fetchMock.mock.calls.map(([input]) =>
        new URL(String(input), "http://localhost").searchParams.get("page")
      )
    await waitFor(() => expect(pagesAsked()).toContain("2"))
    await waitFor(() => expect(pagesAsked().at(-1)).toBe("1"))
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(21))
  })

  it("a new search goes to page 1 without a request mixing old and new state", async () => {
    route((url, method) => {
      if (method !== "GET" || url.pathname !== "/api/v1/admin/categories")
        return undefined
      const page = Number(url.searchParams.get("page"))
      return json(200, {
        items: [category(page)],
        page,
        pageSize: 20,
        total: url.searchParams.get("q") ? 1 : 21,
      })
    })
    const user = userEvent.setup()
    renderScreen()
    await screen.findByRole("table", { name: "Categories" })
    const pager = screen.getByRole("navigation", { name: "Pagination" })
    await user.click(within(pager).getByRole("button", { name: "Next" }))
    await waitFor(() => expect(lastUrl().searchParams.get("page")).toBe("2"))
    const before = fetchMock.mock.calls.length
    await user.type(
      screen.getByRole("searchbox", { name: "Search categories" }),
      "x"
    )
    await waitFor(() => expect(lastUrl().searchParams.get("q")).toBe("x"))
    const after = fetchMock.mock.calls
      .slice(before)
      .map(([input]) => new URL(String(input), "http://localhost").searchParams)
      .filter((p) => p.get("sort") !== "sortOrder:asc")
    expect(after.map((p) => `${p.get("page")}:${p.get("q")}`)).toEqual(["1:x"])
  })

  it("reopening ?edit after a save shows the saved value, not the cache", async () => {
    const target = category(2)
    let stored = { ...target }
    route(async (url, method, init) => {
      if (url.pathname !== `/api/v1/admin/categories/${target.id}`)
        return undefined
      if (method === "PUT") {
        stored = { ...stored, ...JSON.parse(String(init!.body)) }
        return json(200, stored)
      }
      return json(200, stored)
    })
    const client = makeQueryClient()
    const tree = () => (
      <AdminShell queryClient={client} session={session(["editor"])}>
        <CollectionScreen name="categories" />
      </AdminShell>
    )
    const user = userEvent.setup()
    search.current = new URLSearchParams(`edit=${target.id}`)
    const { rerender } = render(tree())
    const sheet = await screen.findByRole("dialog", { name: "Category" })
    const name = within(sheet).getByRole("textbox", { name: "Name" })
    await waitFor(() => expect(name).toHaveValue("Category 2"))
    await user.clear(name)
    await user.type(name, "Renamed")
    await user.click(within(sheet).getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/admin/categories")
    )
    // The router drops ?edit, then ⌘K opens the same record again.
    search.current = new URLSearchParams()
    rerender(tree())
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    search.current = new URLSearchParams(`edit=${target.id}`)
    rerender(tree())
    const again = await screen.findByRole("dialog", { name: "Category" })
    await waitFor(() =>
      expect(within(again).getByRole("textbox", { name: "Name" })).toHaveValue(
        "Renamed"
      )
    )
  })

  it("a viewer following ?edit gets the list without the param or an editor", async () => {
    search.current = new URLSearchParams(`edit=${category(1).id}`)
    renderScreen(["viewer"])
    await screen.findByRole("table", { name: "Categories" })
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/admin/categories")
    )
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})

describe("reorder panel save", () => {
  const ids = (n: number[]) => n.map((i) => category(i).id)

  it("PUTs the full new order, then returns to the list", async () => {
    const puts: unknown[] = []
    route((url, method, init) => {
      if (
        method === "PUT" &&
        url.pathname === "/api/v1/admin/reorder/categories"
      ) {
        puts.push(JSON.parse(String(init!.body)))
        return json(200, { ids: [] })
      }
      return undefined
    })
    const user = userEvent.setup()
    renderScreen()
    await screen.findByRole("table", { name: "Categories" })
    await user.click(screen.getByRole("button", { name: "Change order" }))
    await screen.findByRole("list", { name: "Categories order" })
    const save = screen.getByRole("button", { name: "Save order" })
    expect(save).toBeDisabled()
    await user.click(
      screen.getByRole("button", { name: "Move Category 1 down" })
    )
    await user.click(save)
    await waitFor(() => expect(puts).toEqual([{ ids: ids([2, 1, 3]) }]))
    expect(
      await screen.findByRole("table", { name: "Categories" })
    ).toBeInTheDocument()
  })

  it("on 409 reloads the current order and drops the local one", async () => {
    route((url, method) =>
      method === "PUT" && url.pathname === "/api/v1/admin/reorder/categories"
        ? json(409, {
            error: {
              code: "CONFLICT",
              message: "Changed",
              current: { ids: [] },
            },
          })
        : undefined
    )
    const user = userEvent.setup()
    renderScreen()
    await screen.findByRole("table", { name: "Categories" })
    await user.click(screen.getByRole("button", { name: "Change order" }))
    const list = await screen.findByRole("list", { name: "Categories order" })
    await user.click(
      screen.getByRole("button", { name: "Move Category 1 down" })
    )
    const firstPages = () =>
      fetchMock.mock.calls.filter(([input]) => {
        const url = new URL(String(input), "http://localhost")
        return (
          url.searchParams.get("sort") === "sortOrder:asc" &&
          url.searchParams.get("page") === "1"
        )
      }).length
    const before = firstPages()
    await user.click(screen.getByRole("button", { name: "Save order" }))
    await waitFor(() => expect(firstPages()).toBe(before + 1))
    await waitFor(() =>
      expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent(
        "Category 1"
      )
    )
    expect(screen.getByRole("button", { name: "Save order" })).toBeDisabled()
  })

  it("shows Try again when the order cannot be loaded", async () => {
    let fail = true
    route((url, method) =>
      fail &&
      method === "GET" &&
      url.pathname === "/api/v1/admin/categories" &&
      url.searchParams.get("sort") === "sortOrder:asc"
        ? json(403, { error: { code: "FORBIDDEN", message: "Not allowed" } })
        : undefined
    )
    const user = userEvent.setup()
    renderScreen()
    await screen.findByRole("table", { name: "Categories" })
    await user.click(screen.getByRole("button", { name: "Change order" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Not allowed")
    fail = false
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(
      await screen.findByRole("list", { name: "Categories order" })
    ).toBeInTheDocument()
  })
})

describe("SortableList (keyboard alternative to dragging)", () => {
  it("moves items with the Move buttons and keeps focus on the moved item", async () => {
    const user = userEvent.setup()
    const onReorder = vi.fn()
    const items = [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Bravo" },
      { id: "c", label: "Charlie" },
    ]
    const { rerender } = render(
      <SortableList label="Order" items={items} onReorder={onReorder} />
    )
    screen.getByRole("button", { name: "Move Alpha down" }).focus()
    await user.keyboard("{Enter}")
    const next = onReorder.mock.calls[0][0] as typeof items
    expect(next.map((i) => i.id)).toEqual(["b", "a", "c"])
    rerender(<SortableList label="Order" items={next} onReorder={onReorder} />)
    await waitFor(() =>
      expect(document.activeElement).toHaveAccessibleName("Move Alpha down")
    )
    expect(screen.getByRole("button", { name: "Move Bravo up" })).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Drag to reorder Charlie" })
    ).toHaveAttribute("aria-roledescription", "sortable")
  })
})

describe("slugify", () => {
  it.each([
    ["Event Security", "event-security"],
    ["Mobile Patrols & Key Holding", "mobile-patrols-and-key-holding"],
    ["  Café  24/7 ", "cafe-24-7"],
  ])("%s → %s", (title, slug) => expect(slugify(title)).toBe(slug))
})
