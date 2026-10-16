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
