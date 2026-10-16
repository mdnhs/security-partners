import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { replace, refresh } = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/users",
  useRouter: () => ({ push: vi.fn(), replace, refresh }),
  useSearchParams: () => new URLSearchParams(),
}))

import { AdminProviders, makeQueryClient } from "@/components/admin/providers"
import { AdminSessionProvider } from "@/components/admin/session-provider"
import { UserDetail } from "@/components/admin/users/user-detail"
import { UsersScreen } from "@/components/admin/users/users-screen"
import type { Role } from "@/lib/auth/roles"

const ME = "0190f0e0-0000-7000-8000-000000000000"
const OWNER = "0190f0e0-0000-7000-8000-000000000001"
const EDITOR = "0190f0e0-0000-7000-8000-000000000002"
const INVITED = "0190f0e0-0000-7000-8000-000000000003"
const INVITE_URL = "http://localhost:3000/admin/set-password?token=abc"
const RESET_URL = "http://localhost:3000/admin/reset-password?token=def"

const person = (over: Record<string, unknown>) => ({
  id: EDITOR,
  name: "Edith Editor",
  email: "edith@example.test",
  title: null,
  roles: ["editor"],
  status: "active",
  banReason: null,
  banExpires: null,
  twoFactorEnabled: false,
  createdAt: "2026-10-16T09:00:00.000Z",
  ...over,
})

const PEOPLE = [
  person({
    id: OWNER,
    name: "Olive Owner",
    email: "olive@example.test",
    roles: ["owner"],
    twoFactorEnabled: true,
  }),
  person({}),
  person({
    id: INVITED,
    name: "Ivy Invitee",
    email: "ivy@example.test",
    roles: ["viewer"],
    status: "invited",
  }),
]

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

const fetchMock = vi.fn()
const calls = (method: string, path: string) =>
  fetchMock.mock.calls.filter(
    ([input, init]) =>
      (init?.method ?? "GET") === method &&
      new URL(String(input), "http://localhost").pathname === path
  )
const bodyOf = (method: string, path: string) =>
  JSON.parse(String(calls(method, path).at(-1)![1].body))
const lastListUrl = () =>
  new URL(
    String(calls("GET", "/api/v1/admin/users").at(-1)![0]),
    "http://localhost"
  )

beforeEach(() => {
  replace.mockReset()
  refresh.mockReset()
  fetchMock.mockReset()
  fetchMock.mockImplementation(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost")
      const method = init?.method ?? "GET"
      const path = url.pathname.replace("/api/v1/admin/users", "")
      if (method === "GET" && path === "")
        return json(200, {
          items: PEOPLE,
          page: Number(url.searchParams.get("page")),
          pageSize: Number(url.searchParams.get("pageSize")),
          total: PEOPLE.length,
        })
      if (method === "POST" && path === "/invite") {
        const body = JSON.parse(String(init?.body))
        return json(201, {
          user: person({ id: ME, ...body, status: "invited" }),
          inviteUrl: INVITE_URL,
          emailDelivered: false,
        })
      }
      const [, id, action] = path.split("/")
      const target = PEOPLE.find((p) => p.id === id) ?? person({ id })
      if (method === "GET" && !action) return json(200, target)
      if (method === "GET" && action === "sessions")
        return json(200, {
          items: [
            {
              id: "s1",
              ipAddress: "203.0.113.9",
              userAgent:
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
              createdAt: "2026-10-16T08:00:00.000Z",
              expiresAt: "2026-10-23T08:00:00.000Z",
              impersonatedBy: null,
            },
          ],
        })
      if (method === "DELETE" && action === "sessions")
        return json(200, { revoked: 1 })
      if (method === "PUT" && action === "roles")
        return json(200, {
          ...target,
          roles: JSON.parse(String(init?.body)).roles,
        })
      if (method === "POST" && action === "ban")
        return json(
          200,
          person({
            ...target,
            status: "banned",
            banReason: "Left the company",
            banExpires: "2026-10-23T09:00:00.000Z",
          })
        )
      if (method === "POST" && action === "password-link")
        return json(200, { url: RESET_URL, emailDelivered: false })
      if (method === "POST" && action === "impersonate")
        return json(200, { user: target, expiresAt: "2026-10-16T10:00:00Z" })
      return json(404, { error: { code: "NOT_FOUND", message: "Not found" } })
    }
  )
  vi.stubGlobal("fetch", fetchMock)
  window.history.replaceState(null, "", "/admin/users")
})

function renderAs(roles: Role[], ui: ReactNode, id = ME) {
  const client = makeQueryClient()
  render(
    <AdminSessionProvider
      value={{
        user: {
          id,
          name: "Me",
          email: "me@example.test",
          title: null,
          twoFactorEnabled: true,
        },
        roles,
        impersonatedBy: null,
      }}
    >
      <AdminProviders cacheKey="test" client={client}>
        {ui}
      </AdminProviders>
    </AdminSessionProvider>
  )
  return client
}

const tab = (name: string) =>
  within(screen.getByRole("tablist", { name: "User sections" })).getByRole(
    "tab",
    { name }
  )

describe("users list (spec §8.1 Users)", () => {
  it("shows status pills and 2FA, filters by role and status on the server", async () => {
    const user = userEvent.setup()
    renderAs(["admin"], <UsersScreen />)
    const table = await screen.findByRole("table", { name: "Users" })
    const olive = within(table).getByRole("row", { name: /Olive Owner/ })
    expect(olive).toHaveTextContent("Active")
    expect(olive).toHaveTextContent("2FA on")
    expect(olive).toHaveTextContent("Owner")
    expect(
      within(table).getByRole("row", { name: /Ivy Invitee/ })
    ).toHaveTextContent("Invited")
    expect(
      within(table).getByRole("link", { name: "Edith Editor" })
    ).toHaveAttribute("href", `/admin/users/${EDITOR}`)
    // Phone cards carry the same facts.
    const cards = screen.getByRole("list", { name: "Users" })
    expect(within(cards).getAllByRole("listitem")).toHaveLength(3)
    expect(within(cards).getAllByRole("listitem")[0]).toHaveTextContent(
      "olive@example.test"
    )

    await user.selectOptions(screen.getByLabelText("Role"), "editor")
    await waitFor(() =>
      expect(lastListUrl().searchParams.get("role")).toBe("editor")
    )
    expect(lastListUrl().searchParams.get("page")).toBe("1")
    await user.selectOptions(screen.getByLabelText("Status"), "invited")
    await waitFor(() =>
      expect(lastListUrl().searchParams.get("status")).toBe("invited")
    )
    expect(lastListUrl().searchParams.get("role")).toBe("editor")
  })

  it("hides the invite button without user:invite", async () => {
    renderAs(["viewer"], <UsersScreen />)
    await screen.findByRole("table", { name: "Users" })
    expect(screen.queryByRole("button", { name: "Invite user" })).toBeNull()
  })

  it("says when nobody matches the filters", async () => {
    fetchMock.mockImplementation(async () =>
      json(200, { items: [], page: 1, pageSize: 20, total: 0 })
    )
    const user = userEvent.setup()
    renderAs(["admin"], <UsersScreen />)
    expect(await screen.findByText("No users yet")).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText("Status"), "banned")
    expect(
      await screen.findByText("Nobody matches these filters")
    ).toBeInTheDocument()
  })
})

describe("invite dialog", () => {
  it("owner invites: validates, sends the roles and shows a copyable link", async () => {
    const user = userEvent.setup()
    renderAs(["owner"], <UsersScreen />)
    await user.click(await screen.findByRole("button", { name: "Invite user" }))
    const dialog = await screen.findByRole("dialog", { name: "Invite user" })
    expect(
      within(dialog).getByRole("checkbox", { name: "Owner" })
    ).toBeInTheDocument()

    await user.click(
      within(dialog).getByRole("button", { name: "Send invitation" })
    )
    expect(
      await within(dialog).findByText("Choose at least one role")
    ).toBeInTheDocument()
    expect(calls("POST", "/api/v1/admin/users/invite")).toHaveLength(0)

    await user.type(
      within(dialog).getByRole("textbox", { name: "Email" }),
      "Nia@Example.test"
    )
    await user.type(
      within(dialog).getByRole("textbox", { name: "Name" }),
      "Nia New"
    )
    await user.type(
      within(dialog).getByRole("textbox", { name: /Job title/ }),
      "Guard"
    )
    await user.click(within(dialog).getByRole("checkbox", { name: "Editor" }))
    await user.click(
      within(dialog).getByRole("button", { name: "Send invitation" })
    )

    const done = await screen.findByRole("dialog", {
      name: "Invitation created",
    })
    expect(bodyOf("POST", "/api/v1/admin/users/invite")).toEqual({
      email: "nia@example.test",
      name: "Nia New",
      title: "Guard",
      roles: ["editor"],
    })
    expect(within(done).getByRole("status")).toHaveTextContent(
      "Email is not set up"
    )
    expect(
      within(done).getByRole("textbox", { name: "Invitation link" })
    ).toHaveValue(INVITE_URL)
    await user.click(within(done).getByRole("button", { name: "Copy link" }))
    expect(
      await within(done).findByRole("button", { name: "Copied" })
    ).toBeInTheDocument()
    await expect(navigator.clipboard.readText()).resolves.toBe(INVITE_URL)
  })

  it("admins are not offered the Owner role", async () => {
    const user = userEvent.setup()
    renderAs(["admin"], <UsersScreen />)
    await user.click(await screen.findByRole("button", { name: "Invite user" }))
    const dialog = await screen.findByRole("dialog", { name: "Invite user" })
    expect(
      within(dialog).getByRole("checkbox", { name: "Admin" })
    ).toBeInTheDocument()
    expect(within(dialog).queryByRole("checkbox", { name: "Owner" })).toBeNull()
  })

  it("shows a duplicate email on the field", async () => {
    const user = userEvent.setup()
    renderAs(["admin"], <UsersScreen />)
    await user.click(await screen.findByRole("button", { name: "Invite user" }))
    const dialog = await screen.findByRole("dialog", { name: "Invite user" })
    fetchMock.mockImplementation(async () =>
      json(409, {
        error: {
          code: "CONFLICT",
          message: "A user with this email already exists",
        },
      })
    )
    await user.type(
      within(dialog).getByRole("textbox", { name: "Email" }),
      "edith@example.test"
    )
    await user.type(within(dialog).getByRole("textbox", { name: "Name" }), "E")
    await user.click(within(dialog).getByRole("checkbox", { name: "Editor" }))
    await user.click(
      within(dialog).getByRole("button", { name: "Send invitation" })
    )
    expect(
      await within(dialog).findByText("A user with this email already exists")
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole("textbox", { name: "Email" })
    ).toHaveAttribute("aria-invalid", "true")
  })
})

describe("user detail", () => {
  it("an admin viewing an owner gets no controls (owner-only)", async () => {
    renderAs(["admin"], <UserDetail id={OWNER} />)
    expect(
      await screen.findByRole("heading", { level: 1, name: "Olive Owner" })
    ).toBeInTheDocument()
    expect(screen.getByRole("note")).toHaveTextContent(
      "Only an owner can change an owner's account."
    )
    expect(screen.queryByRole("tablist")).toBeNull()
    for (const name of [
      "Save profile",
      "Save roles",
      "Ban user",
      "View as",
      "Create password reset link",
      "Sign out everywhere",
    ])
      expect(screen.queryByRole("button", { name })).toBeNull()
    expect(calls("GET", `/api/v1/admin/users/${OWNER}/sessions`)).toHaveLength(
      0
    )
  })

  it("an owner edits roles of an owner too", async () => {
    const user = userEvent.setup()
    renderAs(["owner"], <UserDetail id={OWNER} />)
    expect(
      await screen.findByRole("heading", { level: 1, name: "Olive Owner" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "View as" })).toBeInTheDocument()
    await user.click(tab("Roles"))
    expect(await screen.findByRole("checkbox", { name: "Owner" })).toBeChecked()
  })

  it("bans an editor for 7 days after confirming", async () => {
    const user = userEvent.setup()
    renderAs(["owner"], <UserDetail id={EDITOR} />)
    await screen.findByRole("heading", { level: 1, name: "Edith Editor" })
    await user.click(tab("Access"))
    await user.type(
      await screen.findByRole("textbox", { name: /Reason/ }),
      "Left the company"
    )
    await user.selectOptions(screen.getByLabelText("Duration"), "7")
    await user.click(screen.getByRole("button", { name: "Ban user" }))
    const confirm = await screen.findByRole("alertdialog", {
      name: "Ban Edith Editor?",
    })
    expect(confirm).toHaveTextContent("for 7 days")
    // Confirm buttons are 44 px on touch screens (WCAG 2.5.8), set once at
    // the primitive so every alert dialog complies.
    expect(
      confirm.querySelector('[data-slot="alert-dialog-footer"]')
    ).toHaveClass("pointer-coarse:**:data-[slot=button]:h-11")
    await user.click(within(confirm).getByRole("button", { name: "Ban" }))
    await waitFor(() =>
      expect(bodyOf("POST", `/api/v1/admin/users/${EDITOR}/ban`)).toEqual({
        reason: "Left the company",
        expiresInDays: 7,
      })
    )
    expect(
      await screen.findByRole("button", { name: "Unban" })
    ).toBeInTheDocument()
    expect(screen.getByText(/Left the company/)).toBeInTheDocument()
    // The header pill follows the saved user.
    expect(
      screen.getByRole("heading", { level: 1 }).closest("header")
    ).toHaveTextContent("Banned")
  })

  it("saves roles with PUT", async () => {
    const user = userEvent.setup()
    renderAs(["admin"], <UserDetail id={EDITOR} />)
    await screen.findByRole("heading", { level: 1, name: "Edith Editor" })
    await user.click(tab("Roles"))
    const save = await screen.findByRole("button", { name: "Save roles" })
    expect(save).toBeDisabled()
    await user.click(screen.getByRole("checkbox", { name: "Author" }))
    await user.click(save)
    await waitFor(() =>
      expect(bodyOf("PUT", `/api/v1/admin/users/${EDITOR}/roles`)).toEqual({
        roles: ["editor", "author"],
      })
    )
    await waitFor(() => expect(save).toBeDisabled())
  })

  it("asks before you drop your own admin role (you would lock yourself out)", async () => {
    const base = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init) => {
      const url = new URL(String(input), "http://localhost")
      if (
        (init?.method ?? "GET") === "GET" &&
        url.pathname === `/api/v1/admin/users/${ME}`
      )
        return json(200, person({ id: ME, name: "Me", roles: ["admin"] }))
      return base(input, init)
    })
    const user = userEvent.setup()
    renderAs(["admin"], <UserDetail id={ME} />)
    await screen.findByRole("heading", { level: 1, name: "Me" })
    await user.click(tab("Roles"))
    await user.click(await screen.findByRole("checkbox", { name: "Editor" }))
    await user.click(screen.getByRole("checkbox", { name: "Admin" }))
    await user.click(screen.getByRole("button", { name: "Save roles" }))
    const confirm = await screen.findByRole("alertdialog", {
      name: "Remove your own Admin role?",
    })
    expect(confirm).toHaveTextContent(/lose access to Users/)
    expect(calls("PUT", `/api/v1/admin/users/${ME}/roles`)).toHaveLength(0)
    await user.click(
      within(confirm).getByRole("button", { name: "Remove role" })
    )
    await waitFor(() =>
      expect(bodyOf("PUT", `/api/v1/admin/users/${ME}/roles`)).toEqual({
        roles: ["editor"],
      })
    )
  })

  it("creates a password link and signs the user out everywhere", async () => {
    const user = userEvent.setup()
    renderAs(["admin"], <UserDetail id={EDITOR} />)
    await screen.findByRole("heading", { level: 1, name: "Edith Editor" })
    await user.click(tab("Password"))
    await user.click(
      await screen.findByRole("button", { name: "Create password reset link" })
    )
    expect(
      await screen.findByRole("textbox", { name: "Password reset link" })
    ).toHaveValue(RESET_URL)

    await user.click(tab("Sessions"))
    const sessions = await screen.findByRole("list", { name: "Sessions" })
    expect(sessions).toHaveTextContent("Chrome on macOS")
    expect(sessions).toHaveTextContent("203.0.113.9")
    await user.click(
      screen.getByRole("button", { name: "Sign out everywhere" })
    )
    const confirm = await screen.findByRole("alertdialog", {
      name: "Sign Edith Editor out everywhere?",
    })
    await user.click(
      within(confirm).getByRole("button", { name: "Sign out everywhere" })
    )
    await waitFor(() =>
      expect(
        calls("DELETE", `/api/v1/admin/users/${EDITOR}/sessions`)
      ).toHaveLength(1)
    )
  })

  it("View as: confirm, start the impersonation, drop the cache, reload the admin", async () => {
    const user = userEvent.setup()
    const client = renderAs(["admin"], <UserDetail id={EDITOR} />)
    const clear = vi.spyOn(client, "clear")
    await user.click(await screen.findByRole("button", { name: "View as" }))
    const confirm = await screen.findByRole("alertdialog", {
      name: "View the admin as Edith Editor?",
    })
    await user.click(
      within(confirm).getByRole("button", { name: "Start viewing" })
    )
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"))
    expect(refresh).toHaveBeenCalled()
    expect(clear).toHaveBeenCalled()
    expect(
      calls("POST", `/api/v1/admin/users/${EDITOR}/impersonate`)
    ).toHaveLength(1)
  })

  it("never offers to ban or view as yourself", async () => {
    const user = userEvent.setup()
    renderAs(["admin"], <UserDetail id={EDITOR} />, EDITOR)
    await screen.findByRole("heading", { level: 1, name: "Edith Editor" })
    expect(screen.queryByRole("button", { name: "View as" })).toBeNull()
    await user.click(tab("Access"))
    expect(
      await screen.findByText("You cannot ban your own account.")
    ).toBeInTheDocument()
  })

  it("explains a missing user and links back to the list", async () => {
    fetchMock.mockImplementation(async () =>
      json(404, { error: { code: "NOT_FOUND", message: "User not found" } })
    )
    renderAs(["admin"], <UserDetail id={EDITOR} />)
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("This user does not exist")
    expect(
      within(alert).getByRole("link", { name: "All users" })
    ).toHaveAttribute("href", "/admin/users")
  })
})
