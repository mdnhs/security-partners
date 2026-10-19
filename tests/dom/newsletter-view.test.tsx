import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const replace = vi.fn()
let search = ""
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/newsletter",
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}))

import { NewsletterView } from "@/components/admin/newsletter/newsletter-view"
import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { Role } from "@/lib/auth/roles"
import type { SubscriberDto } from "@/lib/schemas/api/newsletter"
import type { NewsletterPlacement } from "@/lib/schemas/settings/newsletter"

const ID = "0190a6e0-0000-7000-8000-0000000000cc"
const ann: SubscriberDto = {
  id: ID,
  email: "ann@example.ie",
  status: "confirmed",
  sourcePath: "/blog",
  createdAt: "2026-10-01T09:00:00.000Z",
  confirmedAt: "2026-10-02T09:00:00.000Z",
  unsubscribedAt: null,
}

let items: SubscriberDto[] = [ann]
const calls: { url: string; method: string }[] = []

beforeEach(() => {
  calls.length = 0
  search = ""
  items = [ann]
  replace.mockClear()
  window.history.replaceState(null, "", "/admin/newsletter")
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      const method =
        init?.method ?? (input instanceof Request ? input.method : "GET")
      calls.push({ url, method })
      const reply = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), {
          status,
          headers: { "content-type": "application/json" },
        })
      if (method === "DELETE") return reply({ ok: true })
      return reply({ items, page: 1, pageSize: 25, total: items.length })
    })
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

function renderAs(
  roles: Role[],
  placement: NewsletterPlacement | null = "blog"
) {
  render(
    <AdminShell
      queryClient={makeQueryClient()}
      site={{ url: "http://localhost:3000", env: "development" }}
      session={{
        user: {
          id: "u",
          name: "Mo Marketer",
          email: "mo@x.test",
          title: null,
          twoFactorEnabled: true,
        },
        roles,
        impersonatedBy: null,
      }}
    >
      <NewsletterView placement={placement} />
    </AdminShell>
  )
}

const lists = () =>
  calls.filter((c) => c.method === "GET" && /\/newsletter\?/.test(c.url))

describe("NewsletterView (D4.3)", () => {
  it("shows the header, the Confirmed tab first and the subscriber row", async () => {
    renderAs(["admin"])
    expect(
      screen.getByRole("heading", { level: 1, name: "Newsletter" })
    ).toBeInTheDocument()
    expect(
      screen.getByText("People who signed up for the newsletter.")
    ).toBeInTheDocument()
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Confirmed",
      "Pending",
      "Unsubscribed",
      "All",
    ])
    expect(screen.getByRole("tab", { name: "Confirmed" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    const table = await screen.findByRole("table", { name: "Subscribers" })
    expect(within(table).getByText("ann@example.ie")).toBeInTheDocument()
    expect(within(table).getByText("Confirmed")).toHaveAttribute(
      "data-tone",
      "success"
    )
    expect(within(table).getByText("/blog")).toBeInTheDocument()
    expect(lists()[0]!.url).toContain("status=confirmed")
    expect(lists()[0]!.url).toContain("pageSize=25")
  })

  it("tabs drive the status query and the ?tab= URL", async () => {
    const user = userEvent.setup()
    renderAs(["admin"])
    await screen.findByRole("table", { name: "Subscribers" })
    await user.click(screen.getByRole("tab", { name: "Pending" }))
    await waitFor(() => expect(lists().at(-1)!.url).toContain("status=pending"))
    expect(replace).toHaveBeenLastCalledWith("/admin/newsletter?tab=pending", {
      scroll: false,
    })
    await user.click(screen.getByRole("tab", { name: "All" }))
    await waitFor(() => expect(lists().at(-1)!.url).not.toContain("status="))
    expect(replace).toHaveBeenLastCalledWith("/admin/newsletter?tab=all", {
      scroll: false,
    })
  })

  it("opens on the tab in the URL", async () => {
    search = "tab=unsubscribed"
    renderAs(["admin"])
    expect(screen.getByRole("tab", { name: "Unsubscribed" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await waitFor(() =>
      expect(lists()[0]!.url).toContain("status=unsubscribed")
    )
  })

  it("exports all statuses on the All tab (owner/admin), confirmed otherwise", async () => {
    const user = userEvent.setup()
    renderAs(["admin"])
    const button = screen.getByRole("button", { name: "Export CSV" })
    expect(button).toHaveAttribute(
      "data-href",
      "/api/v1/admin/newsletter/export.csv?status=confirmed"
    )
    await user.click(screen.getByRole("tab", { name: "All" }))
    expect(screen.getByRole("button", { name: "Export CSV" })).toHaveAttribute(
      "data-href",
      "/api/v1/admin/newsletter/export.csv?status=all"
    )
  })

  it("a marketer exports confirmed only, even on the All tab, and cannot delete", async () => {
    search = "tab=all"
    renderAs(["marketer"])
    await screen.findByRole("table", { name: "Subscribers" })
    expect(screen.getByRole("button", { name: "Export CSV" })).toHaveAttribute(
      "data-href",
      "/api/v1/admin/newsletter/export.csv?status=confirmed"
    )
    expect(screen.queryByRole("button", { name: /Delete/ })).toBeNull()
  })

  it("hides Export without newsletter:export", async () => {
    // No built-in role reads the newsletter without exporting it; a viewer
    // reaching the view (the page guard refuses) still sees no export.
    renderAs(["viewer"])
    expect(screen.queryByRole("button", { name: "Export CSV" })).toBeNull()
  })

  it("asks before deleting a subscriber", async () => {
    const user = userEvent.setup()
    renderAs(["admin"])
    const table = await screen.findByRole("table", { name: "Subscribers" })
    await user.click(
      within(table).getByRole("button", { name: "Delete ann@example.ie" })
    )
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("ann@example.ie")
    expect(calls.some((c) => c.method === "DELETE")).toBe(false)
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
    expect(calls.some((c) => c.method === "DELETE")).toBe(false)

    await user.click(
      within(table).getByRole("button", { name: "Delete ann@example.ie" })
    )
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Delete",
      })
    )
    await waitFor(() =>
      expect(calls.find((c) => c.method === "DELETE")?.url).toBe(
        `/api/v1/admin/newsletter/${ID}`
      )
    )
  })

  it("empty: says so, and points to the placement while it is off", async () => {
    items = []
    renderAs(["admin"], "off")
    expect(await screen.findByText("No subscribers yet")).toBeInTheDocument()
    expect(
      screen.getByText(/Turn on a placement in Site settings › Newsletter/)
    ).toBeInTheDocument()
  })

  it("empty with a placement on: no placement hint", async () => {
    items = []
    renderAs(["admin"], "article")
    expect(await screen.findByText("No subscribers yet")).toBeInTheDocument()
    expect(screen.queryByText(/Turn on a placement/)).toBeNull()
  })
})
