import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ href, ...props }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props} />
  ),
}))

import { DataTablePagination } from "@/components/admin/data-table/data-table-pagination"
import { PagesList } from "@/components/admin/pages/pages-list"
import { makeQueryClient } from "@/components/admin/providers"

const page = (over: Record<string, unknown>) => ({
  key: "home",
  label: "Home",
  template: "home",
  path: "/",
  version: 3,
  status: "published",
  dirty: false,
  publishedAt: "2026-10-01T10:00:00Z",
  updatedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  updatedBy: { id: "u1", name: "Edith Editor" },
  ...over,
})

function renderPages() {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <PagesList />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        items: [
          page({}),
          page({ key: "about", label: "About", path: "/about", dirty: true }),
          page({
            key: "terms",
            label: "Terms",
            path: "/terms",
            publishedAt: null,
            status: "draft",
          }),
        ],
      })
    )
  )
})

describe("pages list (JW pattern)", () => {
  it("shows Title, Address, Status and Updated in a card table", async () => {
    renderPages()
    const table = await screen.findByRole("table", { name: "Pages" })
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((th) => th.textContent)
    ).toEqual(["Title", "Address", "Status", "Updated"])
    expect(table.closest('[data-slot="table-card"]')).toHaveClass(
      "rounded-card",
      "bg-card"
    )
    const rows = within(table).getAllByRole("row").slice(1)
    expect(within(rows[0]).getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/admin/pages/home"
    )
    expect(
      within(rows[0]).getByText("/", { selector: "code" })
    ).toBeInTheDocument()
    expect(rows[0]).toHaveTextContent("Published")
    expect(rows[0]).toHaveTextContent("2 hours ago · Edith Editor")
    expect(rows[1]).toHaveTextContent("PublishedUnpublished changes")
    expect(rows[2]).toHaveTextContent("Draft")
  })

  it("lists cards on phones with the same facts", async () => {
    renderPages()
    const list = await screen.findByRole("list", { name: "Pages" })
    const cards = within(list).getAllByRole("listitem")
    expect(cards).toHaveLength(3)
    expect(cards[2]).toHaveTextContent("Terms")
    expect(cards[2]).toHaveTextContent("/terms")
    expect(cards[2]).toHaveTextContent("Draft")
    // The whole card is the link's target (stretched link), like Services.
    expect(cards[0]).toHaveClass("relative")
    expect(within(cards[0]).getByRole("link", { name: "Home" })).toHaveClass(
      "after:absolute",
      "after:inset-0"
    )
  })

  it("dates rows relative to the last fetch, exact time on hover", async () => {
    renderPages()
    const table = await screen.findByRole("table", { name: "Pages" })
    const time = within(table).getAllByText(/2 hours ago/, {
      selector: "time",
    })[0]
    expect(time).toHaveAttribute("dateTime")
    expect(time).toHaveAttribute("title")
  })

  it("offers Try again when the list fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          // 4xx is final for the admin QueryClient (no retry delay).
          { error: { code: "FORBIDDEN", message: "Not allowed" } },
          { status: 403 }
        )
      )
    )
    renderPages()
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("The pages didn't load")
    expect(alert).toHaveTextContent("Not allowed")
    expect(
      within(alert).getByRole("button", { name: "Try again" })
    ).toBeInTheDocument()
  })
})

describe("DataTablePagination", () => {
  it("disables Next on an exactly full last page", () => {
    render(
      <DataTablePagination
        page={2}
        pageSize={20}
        total={40}
        onPageChange={vi.fn()}
      />
    )
    const nav = screen.getByRole("navigation", { name: "Pagination" })
    expect(nav).toHaveTextContent("21–40 of 40")
    expect(
      within(nav).getByRole("button", { name: "Next page" })
    ).toBeDisabled()
    expect(
      within(nav).getByRole("button", { name: "Previous page" })
    ).toBeEnabled()
  })

  it("clamps a page past the end to the last page", async () => {
    const onPageChange = vi.fn()
    const user = userEvent.setup()
    render(
      <DataTablePagination
        page={9}
        pageSize={20}
        total={45}
        onPageChange={onPageChange}
      />
    )
    const nav = screen.getByRole("navigation", { name: "Pagination" })
    expect(nav).toHaveTextContent("41–45 of 45")
    expect(
      within(nav).getByRole("button", { name: "Next page" })
    ).toBeDisabled()
    await user.click(within(nav).getByRole("button", { name: "Previous page" }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it("disables both buttons while the next page loads", () => {
    render(
      <DataTablePagination
        page={2}
        pageSize={20}
        total={60}
        disabled
        onPageChange={vi.fn()}
      />
    )
    const nav = screen.getByRole("navigation", { name: "Pagination" })
    expect(
      within(nav).getByRole("button", { name: "Next page" })
    ).toBeDisabled()
    expect(
      within(nav).getByRole("button", { name: "Previous page" })
    ).toBeDisabled()
  })

  it("shows the range and chevron buttons with names", async () => {
    const onPageChange = vi.fn()
    const user = userEvent.setup()
    render(
      <DataTablePagination
        page={2}
        pageSize={20}
        total={45}
        onPageChange={onPageChange}
      />
    )
    const nav = screen.getByRole("navigation", { name: "Pagination" })
    expect(nav).toHaveTextContent("21–40 of 45")
    await user.click(within(nav).getByRole("button", { name: "Next page" }))
    expect(onPageChange).toHaveBeenCalledWith(3)
    await user.click(within(nav).getByRole("button", { name: "Previous page" }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it("says No results and disables both buttons when empty", () => {
    render(
      <DataTablePagination
        page={1}
        pageSize={20}
        total={0}
        onPageChange={vi.fn()}
      />
    )
    const nav = screen.getByRole("navigation", { name: "Pagination" })
    expect(nav).toHaveTextContent("No results")
    expect(
      within(nav).getByRole("button", { name: "Next page" })
    ).toBeDisabled()
    expect(
      within(nav).getByRole("button", { name: "Previous page" })
    ).toBeDisabled()
  })
})
