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

function renderScreen() {
  render(
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
      <AdminProviders cacheKey="test" client={makeQueryClient()}>
        <UsersScreen />
      </AdminProviders>
    </AdminSessionProvider>
  )
}

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

  it("?tab=roles opens straight on the matrix", () => {
    search.value = "tab=roles"
    renderScreen()
    expect(screen.getByRole("table", { name: MATRIX })).toBeInTheDocument()
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
