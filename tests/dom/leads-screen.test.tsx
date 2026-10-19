import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const push = vi.fn()
const replace = vi.fn()
const refresh = vi.fn()
// The screen writes the URL with the native history API (Next keeps
// useSearchParams in sync with it): read the live address.
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/leads",
  useRouter: () => ({ push, replace, refresh }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

import { LeadsScreen } from "@/components/admin/leads/leads-screen"
import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { Role } from "@/lib/auth/roles"
import type { LeadDto } from "@/lib/schemas/api/leads"

const ID = "0190a6e0-0000-7000-8000-0000000000aa"
const GONE = "0190a6e0-0000-7000-8000-0000000000bb"
const lead: LeadDto = {
  id: ID,
  name: "Dinn Rí",
  email: "dinn@example.ie",
  phone: "085 000 0000",
  company: "Rí Security",
  service: null,
  status: "new",
  assignee: null,
  sourcePage: "/contact",
  createdAt: "2026-10-16T09:00:00.000Z",
  updatedAt: "2026-10-16T09:00:00.000Z",
  message: "Line one\nLine two",
  consent: true,
  attribution: null,
  events: [
    {
      id: "e1",
      type: "created",
      body: "Sent from /contact",
      actor: null,
      createdAt: "2026-10-16T09:00:00.000Z",
    },
  ],
}

const calls: { url: string; method: string }[] = []
beforeEach(() => {
  calls.length = 0
  push.mockClear()
  replace.mockClear()
  refresh.mockClear()
  window.history.replaceState(null, "", "/admin/leads")
  try {
    window.localStorage.removeItem("sp-leads-view")
  } catch {
    // jsdom always has storage
  }
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
      if (url.includes("/leads/assignees"))
        return reply({
          items: [{ id: "u", name: "Ian Intake", email: "ian@x.test" }],
        })
      if (url.includes(`/leads/${GONE}`))
        return reply(
          { error: { code: "NOT_FOUND", message: "Not found" } },
          404
        )
      if (url.includes(`/leads/${ID}`)) {
        if (method === "DELETE") return reply({ ok: true })
        return reply(lead)
      }
      return reply({ items: [lead], page: 1, pageSize: 20, total: 1 })
    })
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

function renderAs(roles: Role[] = ["intake"]) {
  render(
    <AdminShell
      queryClient={makeQueryClient()}
      site={{ url: "http://localhost:3000", env: "development" }}
      session={{
        user: {
          id: "u",
          name: "Ian Intake",
          email: "ian@x.test",
          title: null,
          twoFactorEnabled: true,
        },
        roles,
        impersonatedBy: null,
      }}
    >
      <LeadsScreen />
    </AdminShell>
  )
}

const listCalls = () =>
  calls.filter((c) => /\/api\/v1\/admin\/leads\?/.test(c.url))

describe("leads screen: Inbox/Spam tabs, view toggle, drawer (D3.2)", () => {
  it("the Spam tab requests status=spam and hides the board toggle", async () => {
    const user = userEvent.setup()
    renderAs()
    await screen.findByRole("table", { name: "Leads" })
    const tabs = screen.getByRole("tablist", { name: "Folders" })
    expect(
      within(tabs)
        .getAllByRole("tab")
        .map((t) => t.textContent)
    ).toEqual(["Inbox", "Spam"])
    expect(within(tabs).getByRole("tab", { name: "Inbox" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    // The inbox asks for everything but spam (no status filter).
    expect(listCalls().every((c) => !c.url.includes("status="))).toBe(true)
    const toggle = screen.getByRole("group", { name: "View" })
    expect(
      within(toggle).getByRole("button", { name: "Board" })
    ).toBeInTheDocument()
    expect(
      within(toggle).getByRole("button", { name: "Table" })
    ).toBeInTheDocument()

    await user.click(within(tabs).getByRole("tab", { name: "Spam" }))
    await waitFor(() =>
      expect(listCalls().some((c) => c.url.includes("status=spam"))).toBe(true)
    )
    expect(screen.queryByRole("group", { name: "View" })).toBeNull()
    // Spam is its own folder: no status filter to pick.
    expect(screen.queryByLabelText("Status")).toBeNull()
    expect(window.location.search).toBe("?folder=spam")

    await user.click(within(tabs).getByRole("tab", { name: "Inbox" }))
    expect(screen.getByRole("group", { name: "View" })).toBeInTheDocument()
    expect(window.location.search).toBe("")
  })

  it("an old ?status=spam link opens the Spam tab", async () => {
    window.history.replaceState(null, "", "/admin/leads?status=spam")
    renderAs()
    await screen.findByRole("table", { name: "Leads" })
    expect(screen.getByRole("tab", { name: "Spam" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    expect(listCalls().some((c) => c.url.includes("status=spam"))).toBe(true)
  })

  it("remembers the chosen view in this browser", async () => {
    const user = userEvent.setup()
    renderAs()
    await screen.findByRole("table", { name: "Leads" })
    const toggle = screen.getByRole("group", { name: "View" })
    expect(
      within(toggle).getByRole("button", { name: "Table" })
    ).toHaveAttribute("aria-pressed", "true")
    await user.click(within(toggle).getByRole("button", { name: "Board" }))
    expect(window.localStorage.getItem("sp-leads-view")).toBe("board")
    expect(window.location.search).toBe("?view=board")
    expect(
      within(toggle).getByRole("button", { name: "Board" })
    ).toHaveAttribute("aria-pressed", "true")
  })

  it("a row click opens the drawer with the lead name heading", async () => {
    const user = userEvent.setup()
    const pushState = vi.spyOn(window.history, "pushState")
    renderAs()
    const table = await screen.findByRole("table", { name: "Leads" })
    const name = await within(table).findByRole("link", { name: "Dinn Rí" })
    // A real link (opens in a new tab), handled in place on a plain click.
    expect(name).toHaveAttribute("href", `/admin/leads?lead=${ID}`)
    await user.click(within(table).getByText("Unassigned"))

    const drawer = await screen.findByRole("dialog", { name: "Dinn Rí" })
    expect(
      within(drawer).getByRole("heading", { name: "Dinn Rí" })
    ).toBeInTheDocument()
    // A history entry, so the browser's Back button closes it.
    expect(pushState).toHaveBeenCalledTimes(1)
    expect(window.location.search).toBe(`?lead=${ID}`)
    for (const section of [
      "Contact",
      "Message",
      "Source",
      "Status & assignee",
      "Notes",
      "Activity",
    ])
      expect(
        await within(drawer).findByRole("region", { name: section })
      ).toBeInTheDocument()
    expect(within(drawer).getByText("Sent from /contact")).toBeInTheDocument()

    await user.click(within(drawer).getByRole("button", { name: "Close" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(window.location.search).toBe("")
  })

  it("the name link opens the drawer; Esc closes it", async () => {
    const user = userEvent.setup()
    renderAs()
    const table = await screen.findByRole("table", { name: "Leads" })
    await user.click(
      await within(table).findByRole("link", { name: "Dinn Rí" })
    )
    await screen.findByRole("dialog", { name: "Dinn Rí" })
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(window.location.search).toBe("")
  })

  it("?lead= opens the drawer on load (detail-page redirect target)", async () => {
    window.history.replaceState(null, "", `/admin/leads?lead=${ID}`)
    renderAs()
    expect(
      await screen.findByRole("dialog", { name: "Dinn Rí" })
    ).toBeInTheDocument()
  })

  it("a missing lead shows the message and clears the param", async () => {
    window.history.replaceState(null, "", `/admin/leads?lead=${GONE}`)
    const user = userEvent.setup()
    renderAs()
    const drawer = await screen.findByRole("dialog")
    expect(
      await within(drawer).findByText("This enquiry no longer exists")
    ).toBeInTheDocument()
    await waitFor(() => expect(window.location.search).toBe(""))
    // The message stays until it is closed.
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    await user.click(within(drawer).getByRole("button", { name: "Close" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("a ?lead= that is not an id opens nothing and is never requested", async () => {
    window.history.replaceState(null, "", "/admin/leads?lead=..%2Fusers")
    renderAs()
    await screen.findByRole("table", { name: "Leads" })
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(calls.some((c) => c.url.includes("users"))).toBe(false)
  })

  it("deleting from the drawer closes it and clears the param", async () => {
    window.history.replaceState(null, "", `/admin/leads?lead=${ID}`)
    const user = userEvent.setup()
    renderAs(["admin"])
    const drawer = await screen.findByRole("dialog", { name: "Dinn Rí" })
    await user.click(
      await within(drawer).findByRole("button", { name: "Delete" })
    )
    await user.click(await screen.findByRole("button", { name: "Delete lead" }))
    await waitFor(() =>
      expect(calls.some((c) => c.method === "DELETE")).toBe(true)
    )
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Dinn Rí" })).toBeNull()
    )
    expect(window.location.search).toBe("")
    expect(push).not.toHaveBeenCalled()
  })
})
