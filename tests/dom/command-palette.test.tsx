import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}))

import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import { isPaletteShortcut } from "@/components/admin/shell/command-palette"
import type { Role } from "@/lib/auth/roles"

function renderShell(roles: Role[] = ["editor"]) {
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
      <p>Body</p>
    </AdminShell>
  )
}

const fetchMock = vi.fn()

beforeEach(() => {
  push.mockReset()
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost")
    expect(url.pathname).toBe("/api/v1/admin/search")
    return new Response(
      JSON.stringify({
        items: [
          {
            type: "service",
            id: "s1",
            title: "Alarm Responses",
            subtitle: "/services/alarm-responses",
            href: "/admin/services/s1",
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  })
  vi.stubGlobal("fetch", fetchMock)
})

describe("⌘K command palette (master 4.1)", () => {
  it("recognises ⌘K and Ctrl+K only", () => {
    const key = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init)
    expect(isPaletteShortcut(key({ key: "k", metaKey: true }))).toBe(true)
    expect(isPaletteShortcut(key({ key: "K", ctrlKey: true }))).toBe(true)
    expect(isPaletteShortcut(key({ key: "k" }))).toBe(false)
    expect(
      isPaletteShortcut(key({ key: "k", ctrlKey: true, shiftKey: true }))
    ).toBe(false)
  })

  it("opens with Ctrl+K, searches records and opens the chosen one", async () => {
    const user = userEvent.setup()
    renderShell()
    await user.keyboard("{Control>}k{/Control}")
    const dialog = await screen.findByRole("dialog", {
      name: "Search the admin",
    })
    await user.type(
      within(dialog).getByRole("combobox", { name: "Search" }),
      "alarm"
    )
    const option = await within(dialog).findByRole("option", {
      name: /Alarm Responses/,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain("q=alarm")
    await user.click(option)
    expect(push).toHaveBeenCalledWith("/admin/services/s1")
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Search the admin" })
      ).toBeNull()
    )
  })

  it("finds people for user:read holders and opens their page (spec §8.2)", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost")
      if (url.pathname === "/api/v1/admin/users") {
        expect(url.searchParams.get("q")).toBe("oli")
        expect(url.searchParams.get("pageSize")).toBe("5")
        return Response.json({
          items: [
            {
              id: "0190f0e0-0000-7000-8000-000000000001",
              name: "Olive Owner",
              email: "olive@example.test",
            },
          ],
          page: 1,
          pageSize: 5,
          total: 1,
        })
      }
      return Response.json({ items: [] })
    })
    const user = userEvent.setup()
    renderShell(["admin"])
    await user.keyboard("{Control>}k{/Control}")
    const dialog = await screen.findByRole("dialog", {
      name: "Search the admin",
    })
    await user.type(
      within(dialog).getByRole("combobox", { name: "Search" }),
      "oli"
    )
    const option = await within(dialog).findByRole("option", {
      name: /Olive Owner/,
    })
    expect(
      within(
        within(dialog).getByRole("group", { name: "People" })
      ).getAllByRole("option")
    ).toHaveLength(1)
    await user.click(option)
    expect(push).toHaveBeenCalledWith(
      "/admin/users/0190f0e0-0000-7000-8000-000000000001"
    )
  })

  it("a failed People query drops only that group: records still show", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost")
      if (url.pathname === "/api/v1/admin/users")
        // 4xx: no retry, so the query settles as an error at once.
        return Response.json(
          { error: { code: "FORBIDDEN", message: "No" } },
          { status: 403 }
        )
      return Response.json({
        items: [
          {
            type: "service",
            id: "s1",
            title: "Alarm Responses",
            subtitle: "/services/alarm-responses",
            href: "/admin/services/s1",
          },
        ],
      })
    })
    const user = userEvent.setup()
    renderShell(["admin"])
    await user.keyboard("{Control>}k{/Control}")
    const dialog = await screen.findByRole("dialog", {
      name: "Search the admin",
    })
    await user.type(
      within(dialog).getByRole("combobox", { name: "Search" }),
      "ala"
    )
    expect(
      await within(dialog).findByRole("option", { name: /Alarm Responses/ })
    ).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(within(dialog).queryByRole("group", { name: "People" })).toBeNull()
    expect(within(dialog).queryByRole("alert")).toBeNull()
  })

  it("never asks for people without user:read", async () => {
    const user = userEvent.setup()
    renderShell(["editor"])
    await user.keyboard("{Control>}k{/Control}")
    const dialog = await screen.findByRole("dialog", {
      name: "Search the admin",
    })
    await user.type(
      within(dialog).getByRole("combobox", { name: "Search" }),
      "oli"
    )
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(
      fetchMock.mock.calls.map(
        ([input]) => new URL(String(input), "http://localhost").pathname
      )
    ).toEqual(["/api/v1/admin/search"])
    expect(within(dialog).queryByRole("group", { name: "People" })).toBeNull()
  })

  it("lists only the sections and actions the user may use", async () => {
    const user = userEvent.setup()
    renderShell(["intake"])
    await user.click(screen.getByRole("button", { name: /Search/ }))
    const dialog = await screen.findByRole("dialog", {
      name: "Search the admin",
    })
    const options = within(dialog)
      .getAllByRole("option")
      .map((o) => o.textContent)
    expect(options).toEqual(["Dashboard", "Account", "Open the public site"])
    await user.type(within(dialog).getByRole("combobox"), "acc")
    expect(
      within(dialog)
        .getAllByRole("option")
        .map((o) => o.textContent)
    ).toEqual(["Account"])
  })

  it("offers the editor's quick actions", async () => {
    const user = userEvent.setup()
    renderShell(["editor"])
    await user.keyboard("{Control>}k{/Control}")
    const dialog = await screen.findByRole("dialog", {
      name: "Search the admin",
    })
    const actions = within(
      within(dialog).getByRole("group", { name: "Actions" })
    )
      .getAllByRole("option")
      .map((o) => o.textContent)
    expect(actions).toEqual([
      "Edit the home page",
      "New service",
      "Open the public site",
    ])
    await user.click(
      within(dialog).getByRole("option", { name: "New service" })
    )
    expect(push).toHaveBeenCalledWith("/admin/services/new")
  })

  it("leaves Mod-K to a focused widget that handles it", async () => {
    const user = userEvent.setup()
    renderShell()
    const claim = (event: KeyboardEvent) => event.preventDefault()
    document.body.addEventListener("keydown", claim)
    try {
      await user.keyboard("{Control>}k{/Control}")
      expect(
        screen.queryByRole("dialog", { name: "Search the admin" })
      ).toBeNull()
    } finally {
      document.body.removeEventListener("keydown", claim)
    }
    await user.keyboard("{Control>}k{/Control}")
    expect(
      await screen.findByRole("dialog", { name: "Search the admin" })
    ).toBeTruthy()
  })

  it("forgets the query whenever it closes", async () => {
    const user = userEvent.setup()
    renderShell()
    const reopen = async () => {
      await user.keyboard("{Control>}k{/Control}")
      const dialog = await screen.findByRole("dialog", {
        name: "Search the admin",
      })
      return within(dialog).getByRole("combobox", { name: "Search" })
    }
    const closed = () =>
      waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: "Search the admin" })
        ).toBeNull()
      )

    // ⌘K toggles it closed
    await user.type(await reopen(), "acc")
    await user.keyboard("{Control>}k{/Control}")
    await closed()
    const input = await reopen()
    expect(input).toHaveValue("")
    // Escape
    await user.type(input, "set")
    await user.keyboard("{Escape}")
    await closed()
    expect(await reopen()).toHaveValue("")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("shows Searching… until the input settles (no flash of no results)", async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    )
    const user = userEvent.setup()
    renderShell()
    await user.keyboard("{Control>}k{/Control}")
    const dialog = await screen.findByRole("dialog", {
      name: "Search the admin",
    })
    await user.type(within(dialog).getByRole("combobox"), "zzz")
    // Still inside the 200 ms debounce: nothing fetched yet.
    expect(fetchMock).not.toHaveBeenCalled()
    expect(within(dialog).getByText("Searching…")).toBeTruthy()
    expect(within(dialog).queryByText(/No results/)).toBeNull()
    expect(
      await within(dialog).findByText("No results for “zzz”.")
    ).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("reports a failed search as an alert, not as no results", async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            error: { code: "VALIDATION", message: "Bad query" },
          }),
          { status: 422, headers: { "content-type": "application/json" } }
        )
    )
    const user = userEvent.setup()
    renderShell()
    await user.keyboard("{Control>}k{/Control}")
    const dialog = await screen.findByRole("dialog", {
      name: "Search the admin",
    })
    await user.type(within(dialog).getByRole("combobox"), "zzz")
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Search failed — try again"
    )
    expect(within(dialog).queryByText(/No results/)).toBeNull()
    expect(within(dialog).queryByText("Searching…")).toBeNull()
  })
})
