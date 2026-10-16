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
})
