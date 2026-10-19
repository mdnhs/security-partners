import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/activity",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import { AuditScreen } from "@/components/admin/audit/audit-screen"
import { AdminProviders, makeQueryClient } from "@/components/admin/providers"
import { AdminSessionProvider } from "@/components/admin/session-provider"
import type { Role } from "@/lib/auth/roles"

const OWNER = "0190f0e0-0000-7000-8000-000000000001"
const EDITOR = "0190f0e0-0000-7000-8000-000000000002"

const people = [
  { id: EDITOR, name: "Edith Editor", email: "edith@example.test" },
  { id: OWNER, name: "Olive Owner", email: "olive@example.test" },
]

const entries = [
  {
    id: "0190f0e0-0000-7000-8000-0000000000a1",
    action: "user.invite",
    entityType: "user",
    entityId: EDITOR,
    actor: { id: OWNER, name: "Olive Owner", email: "olive@example.test" },
    impersonatorId: null,
    ip: "203.0.113.9",
    userAgent: "Mozilla/5.0 (Windows NT 10.0) Firefox/133.0",
    diff: { email: "edith@example.test", roles: ["editor"], title: null },
    createdAt: "2026-07-01T09:30:00.000Z",
  },
  {
    id: "0190f0e0-0000-7000-8000-0000000000a2",
    action: "user.update",
    entityType: "user",
    entityId: EDITOR,
    actor: { id: EDITOR, name: "Edith Editor", email: "edith@example.test" },
    impersonatorId: OWNER,
    ip: null,
    userAgent: null,
    diff: {
      from: { name: "Edith", title: null },
      to: { name: "Edith Editor" },
    },
    createdAt: "2026-07-01T10:00:00.000Z",
  },
]

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

const fetchMock = vi.fn()
const urlsTo = (path: string) =>
  fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((u) => u.pathname === path)
const lastAuditUrl = () => urlsTo("/api/v1/admin/audit").at(-1)!

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/v1/admin/audit")
      return json(200, { items: entries, page: 1, pageSize: 20, total: 2 })
    if (url.pathname === "/api/v1/admin/users") {
      const q = (url.searchParams.get("q") ?? "").toLowerCase()
      const items = people.filter((p) => p.name.toLowerCase().includes(q))
      return json(200, { items, page: 1, pageSize: 20, total: items.length })
    }
    const person = people.find(
      (p) => url.pathname === `/api/v1/admin/users/${p.id}`
    )
    if (person) return json(200, person)
    return json(404, { error: { code: "NOT_FOUND", message: "Not found" } })
  })
  vi.stubGlobal("fetch", fetchMock)
})

function renderScreen(roles: Role[] = ["owner"]) {
  return render(
    <AdminSessionProvider
      value={{
        user: {
          id: OWNER,
          name: "Olive Owner",
          email: "olive@example.test",
          title: null,
          twoFactorEnabled: true,
        },
        roles,
        impersonatedBy: null,
      }}
    >
      <AdminProviders cacheKey="test" client={makeQueryClient()}>
        <AuditScreen />
      </AdminProviders>
    </AdminSessionProvider>
  )
}

describe("audit log (spec §8.1)", () => {
  it("lists entries in Irish time with actor, summary and impersonator", async () => {
    renderScreen()
    const table = await screen.findByRole("table", { name: "Audit log" })
    const invite = within(table).getByRole("row", { name: /user\.invite/ })
    // 09:30 UTC on 1 July = 10:30 in Dublin (IST).
    expect(invite).toHaveTextContent("1 Jul 2026, 10:30")
    expect(invite).toHaveTextContent("Olive Owner")
    expect(invite).toHaveTextContent("invited a user")
    expect(
      await within(table).findByText("viewed as by Olive Owner")
    ).toBeInTheDocument()
  })

  it("filters by actor (searchable), action, record type and Irish dates", async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByRole("table", { name: "Audit log" })
    const who = screen.getByRole("combobox", { name: "Who" })
    expect(who).toHaveTextContent("Anyone")
    await user.click(who)
    const listbox = await screen.findByRole("listbox", { name: "People" })
    await user.type(
      screen.getByRole("combobox", { name: "Search people" }),
      "oli"
    )
    await waitFor(() =>
      expect(within(listbox).getAllByRole("option")).toHaveLength(1)
    )
    expect(urlsTo("/api/v1/admin/users").at(-1)!.searchParams.get("q")).toBe(
      "oli"
    )
    await user.click(
      within(listbox).getByRole("option", { name: /Olive Owner/ })
    )
    expect(who).toHaveTextContent("Olive Owner")

    await user.type(screen.getByLabelText("Action"), "user.invite")
    await user.type(screen.getByLabelText("Record type"), "user")
    await user.type(screen.getByLabelText("From"), "2026-07-01")
    await user.type(screen.getByLabelText("To"), "2026-07-01")
    await waitFor(() => {
      const params = lastAuditUrl().searchParams
      expect(Object.fromEntries(params)).toMatchObject({
        page: "1",
        actor: OWNER,
        action: "user.invite",
        entityType: "user",
        from: "2026-06-30T23:00:00.000Z",
        to: "2026-07-01T22:59:59.999Z",
      })
    })
    await user.click(screen.getByRole("button", { name: "Clear filters" }))
    expect(screen.getByLabelText("Action")).toHaveValue("")
    expect(screen.getByRole("combobox", { name: "Who" })).toHaveTextContent(
      "Anyone"
    )
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull()
  })

  it("hides the actor filter without user:read", async () => {
    renderScreen(["viewer" as Role])
    // Viewers hold no audit:read either; the screen itself is server-gated,
    // so only the toolbar matters here.
    await screen.findByRole("table", { name: "Audit log" })
    expect(screen.queryByRole("combobox", { name: "Who" })).toBeNull()
    expect(urlsTo("/api/v1/admin/users")).toHaveLength(0)
  })

  it("opens the diff viewer with before/after JSON", async () => {
    const user = userEvent.setup()
    renderScreen()
    const table = await screen.findByRole("table", { name: "Audit log" })
    await user.click(
      within(table).getByRole("button", { name: /^Details of user\.update/ })
    )
    const sheet = await screen.findByRole("dialog", { name: "Audit entry" })
    expect(within(sheet).getByLabelText("Before")).toHaveTextContent(
      '"name": "Edith"'
    )
    expect(within(sheet).getByLabelText("After")).toHaveTextContent(
      '"name": "Edith Editor"'
    )
    expect(sheet).toHaveTextContent("Viewed as by")
    expect(sheet).toHaveTextContent("Unknown device")

    await user.keyboard("{Escape}")
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Audit entry" })).toBeNull()
    )
    await user.click(
      within(table).getByRole("button", { name: /^Details of user\.invite/ })
    )
    const invite = await screen.findByRole("dialog", { name: "Audit entry" })
    expect(within(invite).getByLabelText("Details")).toHaveTextContent(
      '"email": "edith@example.test"'
    )
    expect(invite).toHaveTextContent("Firefox on Windows")
    expect(invite).toHaveTextContent("203.0.113.9")
  })
})
