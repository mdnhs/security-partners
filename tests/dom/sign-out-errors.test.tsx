import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

// Better Auth's client binds `fetch` when it is created (module import),
// so a fetch stubbed per test never reaches it: sign-out would go out over
// the network and its outcome would depend on what listens on :3000.
const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }))
vi.mock("@/lib/auth-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth-client")>()),
  authClient: { signOut },
}))

import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"

beforeEach(() => {
  signOut.mockReset()
  signOut.mockResolvedValue({
    data: null,
    error: {
      status: 503,
      statusText: "Service Unavailable",
      message: "Unavailable",
    },
  })
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      return new Response(
        JSON.stringify({ items: [], page: 1, pageSize: 20, total: 0 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    })
  )
})

describe("shell sign-out errors (ledger P04b-4)", () => {
  it("opening the user menu keeps the dock's sign-out error", async () => {
    const user = userEvent.setup()
    render(
      <AdminShell
        queryClient={makeQueryClient()}
        session={{
          user: {
            id: "u1",
            name: "Edith Editor",
            email: "e@x.test",
            title: null,
            twoFactorEnabled: true,
          },
          roles: ["editor"],
          impersonatedBy: null,
        }}
      >
        <p>Body</p>
      </AdminShell>
    )
    // The sidebar renders the dock twice (card and icon rail; CSS shows one).
    await user.click(screen.getAllByRole("button", { name: "Log out" })[0])
    // The dock's error sits in the sidebar footer (other live regions exist).
    const footer = document.querySelector(
      '[data-slot="sidebar-footer"]'
    ) as HTMLElement
    const alert = await within(footer).findByRole("alert")
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(alert).not.toBeEmptyDOMElement()
    const text = alert.textContent ?? ""
    await user.click(
      screen.getByRole("button", { name: "Account menu for Edith Editor" })
    )
    await screen.findByRole("menu")
    await user.keyboard("{Escape}")
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent(text)
  })
})
