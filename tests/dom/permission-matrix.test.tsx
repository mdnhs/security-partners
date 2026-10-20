import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { search } = vi.hoisted(() => ({ search: { value: "" } }))
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/users",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search.value),
}))

import { AdminProviders, makeQueryClient } from "@/components/admin/providers"
import { AdminSessionProvider } from "@/components/admin/session-provider"
import { PermissionMatrix } from "@/components/admin/users/permission-matrix"
import { UsersScreen } from "@/components/admin/users/users-screen"
import { ROLE_INFO } from "@/lib/admin/user-roles"
import { statements } from "@/lib/auth/permissions"
import { ROLES } from "@/lib/auth/roles"

const fetchMock = vi.fn()

beforeEach(() => {
  search.value = ""
  fetchMock.mockReset()
  fetchMock.mockImplementation(
    async () =>
      new Response(
        JSON.stringify({ items: [], page: 1, pageSize: 25, total: 0 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
  )
  vi.stubGlobal("fetch", fetchMock)
  window.history.replaceState(null, "", "/admin/users")
})

function screenTree(client = makeQueryClient()) {
  return (
    <AdminSessionProvider
      value={{
        user: {
          id: "0190f0e0-0000-7000-8000-000000000000",
          name: "Me",
          email: "me@example.test",
          title: null,
          twoFactorEnabled: true,
        },
        roles: ["admin"],
        impersonatedBy: null,
      }}
    >
      <AdminProviders cacheKey="test" client={client}>
        <UsersScreen />
      </AdminProviders>
    </AdminSessionProvider>
  )
}

const renderScreen = () => render(screenTree())

const MATRIX = "Users & roles: permissions"

describe("Users & roles: People / Roles tabs", () => {
  it("opens on People; the Roles tab shows the named permission table and sets ?tab=roles", async () => {
    const user = userEvent.setup()
    renderScreen()
    expect(
      screen.getByRole("heading", { level: 1, name: "Users & roles" })
    ).toBeInTheDocument()
    const tabs = screen.getByRole("tablist", { name: "Users & roles" })
    expect(within(tabs).getByRole("tab", { name: "People" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    expect(screen.queryByRole("table", { name: MATRIX })).toBeNull()

    await user.click(within(tabs).getByRole("tab", { name: "Roles" }))
    expect(screen.getByRole("table", { name: MATRIX })).toBeInTheDocument()
    expect(new URLSearchParams(window.location.search).get("tab")).toBe("roles")

    await user.click(within(tabs).getByRole("tab", { name: "People" }))
    expect(screen.queryByRole("table", { name: MATRIX })).toBeNull()
    expect(new URLSearchParams(window.location.search).has("tab")).toBe(false)
  })

  it("switching tabs keeps ?page= and never remembers tab=roles as the list search", async () => {
    const user = userEvent.setup()
    const KEY = "sp-admin:list:/admin/users"
    window.sessionStorage.removeItem(KEY)
    search.value = "page=2&role=editor"
    window.history.replaceState(null, "", "/admin/users?page=2&role=editor")
    renderScreen()
    const tabs = screen.getByRole("tablist", { name: "Users & roles" })
    const remembered = window.sessionStorage.getItem(KEY)

    await user.click(within(tabs).getByRole("tab", { name: "Roles" }))
    const onRoles = new URLSearchParams(window.location.search)
    expect(onRoles.get("tab")).toBe("roles")
    expect(onRoles.get("page")).toBe("2")
    expect(onRoles.get("role")).toBe("editor")
    expect(window.sessionStorage.getItem(KEY)).toBe(remembered)

    await user.click(within(tabs).getByRole("tab", { name: "People" }))
    expect(new URLSearchParams(window.location.search).has("tab")).toBe(false)
    expect(window.sessionStorage.getItem(KEY) ?? "").not.toContain("tab=")
  })

  it("?tab=roles opens straight on the matrix", () => {
    search.value = "tab=roles"
    renderScreen()
    expect(screen.getByRole("table", { name: MATRIX })).toBeInTheDocument()
  })

  it("a soft navigation to ?tab=roles while mounted switches the tab (D3.4 N1)", () => {
    const client = makeQueryClient()
    const { rerender } = render(screenTree(client))
    expect(screen.queryByRole("table", { name: MATRIX })).toBeNull()
    // ⌘K or a nav link: the URL changes, the screen stays mounted.
    search.value = "tab=roles"
    rerender(screenTree(client))
    expect(screen.getByRole("table", { name: MATRIX })).toBeInTheDocument()
    search.value = ""
    rerender(screenTree(client))
    expect(screen.queryByRole("table", { name: MATRIX })).toBeNull()
  })
})

describe("PermissionMatrix", () => {
  it("has a column header per role and a row group per resource", () => {
    render(<PermissionMatrix />)
    const table = screen.getByRole("table", { name: MATRIX })
    for (const role of ROLES)
      expect(
        within(table).getByRole("columnheader", { name: ROLE_INFO[role].label })
      ).toHaveAttribute("scope", "col")
    const groups = table.querySelectorAll('th[scope="rowgroup"]')
    expect(groups).toHaveLength(Object.keys(statements).length)
    const actionRows = Object.values(statements).flat().length
    expect(table.querySelectorAll('tbody th[scope="row"]')).toHaveLength(
      actionRows
    )
  })

  it("marks cells as Allowed / Not allowed / Own only", () => {
    render(<PermissionMatrix />)
    const table = screen.getByRole("table", { name: MATRIX })
    const customCode = table.querySelector(
      'tbody[data-resource="customCode"]'
    ) as HTMLElement
    const update = within(customCode)
      .getAllByRole("row")
      .find((tr) => tr.getAttribute("data-action") === "update")!
    const cells = within(update).getAllByRole("cell")
    expect(cells[0]).toHaveTextContent("Allowed")
    expect(cells[0]).not.toHaveTextContent("Not allowed")
    for (const cell of cells.slice(1))
      expect(cell).toHaveTextContent("Not allowed")

    const article = table.querySelector(
      'tbody[data-resource="article"]'
    ) as HTMLElement
    const articleUpdate = within(article)
      .getAllByRole("row")
      .find((tr) => tr.getAttribute("data-action") === "update")!
    const authorCell =
      within(articleUpdate).getAllByRole("cell")[ROLES.indexOf("author")]
    expect(authorCell).toHaveTextContent("Own only")
  })

  const cellsOf = (resource: string, action: string) => {
    const table = screen.getByRole("table", { name: MATRIX })
    const group = table.querySelector(
      `tbody[data-resource="${resource}"]`
    ) as HTMLElement
    const tr = within(group)
      .getAllByRole("row")
      .find((r) => r.getAttribute("data-action") === action)!
    const cells = within(tr).getAllByRole("cell")
    return (role: (typeof ROLES)[number]) => cells[ROLES.indexOf(role)]
  }

  it("article.submit is Own only for authors, Allowed for editors", () => {
    render(<PermissionMatrix />)
    const cell = cellsOf("article", "submit")
    expect(cell("author")).toHaveTextContent("Own only")
    expect(cell("editor")).toHaveTextContent(/^Allowed$/)
    expect(cell("viewer")).toHaveTextContent("Not allowed")
  })

  it("viewers are Not allowed every write action (sr text, no icon-only cells)", () => {
    render(<PermissionMatrix />)
    for (const [resource, actions] of Object.entries(statements))
      for (const action of actions) {
        const cell = cellsOf(resource, action)("viewer")
        expect(cell).toHaveTextContent(
          action === "read" ? /^Allowed$|^Not allowed$/ : /^Not allowed$/
        )
      }
    expect(cellsOf("page", "read")("viewer")).toHaveTextContent(/^Allowed$/)
    expect(cellsOf("lead", "read")("viewer")).toHaveTextContent("Not allowed")
    const table = screen.getByRole("table", { name: MATRIX })
    expect(table.querySelectorAll("td svg:not([aria-hidden])")).toHaveLength(0)
  })

  it("lists the runtime limits under the table", () => {
    render(<PermissionMatrix />)
    const notes = screen.getByRole("list", {
      name: "Limits applied at runtime",
    })
    const text = notes.textContent ?? ""
    expect(text).toMatch(/owner accounts/i)
    expect(text).toMatch(/content settings/i)
    expect(text).toMatch(/AI assistant/i)
    expect(text).toMatch(/viewing as someone/i)
    // D3.4 parked footnotes (final review minor 8).
    expect(text).toMatch(/alt text and focal point of their own uploads/i)
    expect(text).toMatch(/own byline/i)
  })

  it("describes every role above the table", () => {
    render(<PermissionMatrix />)
    for (const role of ROLES) {
      expect(
        screen.getByText(ROLE_INFO[role].label, { selector: "dt" })
      ).toBeInTheDocument()
      expect(
        screen.getByText(ROLE_INFO[role].description, { selector: "dd" })
      ).toBeInTheDocument()
    }
  })
})
