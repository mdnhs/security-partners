import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { pathname, router, signOut } = vi.hoisted(() => ({
  pathname: { current: "/admin" },
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
  signOut: vi.fn(),
}))
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
  useRouter: () => router,
}))
// A plain anchor that never navigates (jsdom cannot load another document).
vi.mock("next/link", () => ({
  default: ({
    href,
    onClick,
    ...props
  }: ComponentProps<"a"> & { href: string }) => (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        event.preventDefault()
        onClick?.(event)
      }}
    />
  ),
}))
vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut },
  authErrorMessage: () => "Could not sign out.",
}))

import { makeQueryClient } from "@/components/admin/providers"
import type { AdminSession } from "@/components/admin/session-provider"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { Role } from "@/lib/auth/roles"

const session = (
  roles: Role[],
  impersonatedBy: string | null = null
): AdminSession => ({
  user: {
    id: "u1",
    name: "Edith Editor",
    email: "edith@example.test",
    title: null,
    twoFactorEnabled: false,
  },
  roles,
  impersonatedBy,
})

beforeEach(() => {
  pathname.current = "/admin"
  router.replace.mockReset()
  router.refresh.mockReset()
  signOut.mockReset()
})

describe("AdminShell (master 4.1)", () => {
  it("shows only the sections the roles may read", () => {
    render(
      <AdminShell session={session(["intake"])}>
        <p>Body</p>
      </AdminShell>
    )
    const nav = screen.getByRole("navigation", { name: "Admin" })
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.textContent)
    ).toEqual(["Dashboard", "Account"])
    expect(screen.getByRole("main")).toHaveTextContent("Body")
  })

  it("marks the current section with aria-current", () => {
    pathname.current = "/admin/pages/home"
    render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    const nav = screen.getByRole("navigation", { name: "Admin" })
    expect(within(nav).getByRole("link", { name: "Pages" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(
      within(nav).getByRole("link", { name: "Dashboard" })
    ).not.toHaveAttribute("aria-current")
  })

  it("opens the navigation in a sheet from the topbar (< 1024 px)", async () => {
    const user = userEvent.setup()
    render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    await user.click(screen.getByRole("button", { name: "Open navigation" }))
    const sheet = await screen.findByRole("dialog", { name: "Navigation" })
    await user.click(within(sheet).getByRole("link", { name: "Services" }))
    expect(screen.queryByRole("dialog", { name: "Navigation" })).toBeNull()
  })

  it("shows the topbar user, sign out and a skip link", () => {
    render(
      <AdminShell session={session(["editor", "author"])}>
        <p>Body</p>
      </AdminShell>
    )
    const banner = screen.getByRole("banner")
    expect(banner).toHaveTextContent("Edith Editor")
    expect(banner).toHaveTextContent("editor, author")
    expect(
      within(banner).getByRole("button", { name: "Sign out" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Skip to content" })
    ).toHaveAttribute("href", "#main")
  })

  it("shows the impersonation banner only while impersonating", () => {
    const { rerender } = render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    expect(screen.queryByRole("region", { name: "Impersonation" })).toBeNull()
    rerender(
      <AdminShell session={session(["editor"], "owner-1")}>
        <p>Body</p>
      </AdminShell>
    )
    const banner = screen.getByRole("region", { name: "Impersonation" })
    expect(banner).toHaveTextContent(
      "You are viewing the admin as Edith Editor"
    )
    expect(
      within(banner).getByRole("button", { name: "Stop impersonating" })
    ).toBeEnabled()
  })

  it("stacks the impersonation banner above the topbar in one sticky header", () => {
    render(
      <AdminShell session={session(["editor"], "owner-1")}>
        <p>Body</p>
      </AdminShell>
    )
    const banner = screen.getByRole("region", { name: "Impersonation" })
    const topbar = screen.getByRole("banner")
    const header = topbar.parentElement!
    expect(header).toHaveClass("sticky", "top-0")
    expect(banner.parentElement).toBe(header)
    expect(header.firstElementChild).toBe(banner)
    // Neither sticks on its own (they would overlap at top: 0).
    expect(banner).not.toHaveClass("sticky")
    expect(topbar).not.toHaveClass("sticky")
    // The full-height sidebar sits beside the header, never under it.
    const sidebar = document.querySelector("aside")!
    expect(header.contains(sidebar)).toBe(false)
    expect(sidebar.parentElement).toBe(header.parentElement!.parentElement)
  })

  it("stop impersonating: calls the API, drops the cache and goes to /admin", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ ok: true })
    )
    vi.stubGlobal("fetch", fetchMock)
    const client = makeQueryClient()
    const clear = vi.spyOn(client, "clear")
    const user = userEvent.setup()
    render(
      <AdminShell session={session(["editor"], "owner-1")} queryClient={client}>
        <p>Body</p>
      </AdminShell>
    )
    await user.click(screen.getByRole("button", { name: "Stop impersonating" }))
    await waitFor(() => expect(router.refresh).toHaveBeenCalled())
    const [input, init] = fetchMock.mock.calls[0]
    expect(new URL(String(input), "http://localhost").pathname).toBe(
      "/api/v1/admin/users/stop-impersonating"
    )
    expect(init?.method).toBe("POST")
    expect(clear).toHaveBeenCalled()
    expect(router.replace).toHaveBeenCalledWith("/admin")
  })

  it("stop impersonating: shows the API error and re-enables the button", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: { code: "FORBIDDEN", message: "Not impersonating" } },
          { status: 403 }
        )
      )
    )
    const user = userEvent.setup()
    render(
      <AdminShell session={session(["editor"], "owner-1")}>
        <p>Body</p>
      </AdminShell>
    )
    const button = screen.getByRole("button", { name: "Stop impersonating" })
    await user.click(button)
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Not impersonating"
    )
    expect(button).toBeEnabled()
    expect(router.replace).not.toHaveBeenCalled()
  })

  it("clears the query cache on sign out", async () => {
    signOut.mockResolvedValue({ error: null })
    const client = makeQueryClient()
    const clear = vi.spyOn(client, "clear")
    const user = userEvent.setup()
    render(
      <AdminShell session={session(["editor"])} queryClient={client}>
        <p>Body</p>
      </AdminShell>
    )
    await user.click(
      within(screen.getByRole("banner")).getByRole("button", {
        name: "Sign out",
      })
    )
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        "/admin/sign-in?notice=signed-out"
      )
    )
    expect(clear).toHaveBeenCalled()
  })

  it("closes the navigation sheet from the brand link too", async () => {
    const user = userEvent.setup()
    render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    await user.click(screen.getByRole("button", { name: "Open navigation" }))
    const sheet = await screen.findByRole("dialog", { name: "Navigation" })
    await user.click(
      within(sheet).getByRole("link", { name: /Security Partners/ })
    )
    expect(screen.queryByRole("dialog", { name: "Navigation" })).toBeNull()
  })

  it("names each navigation group by its section label", () => {
    render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    const nav = screen.getByRole("navigation", { name: "Admin" })
    expect(
      within(nav)
        .getAllByRole("list")
        .map((list) => list.getAttribute("aria-labelledby"))
        .map((id) => document.getElementById(id!)?.textContent)
    ).toEqual(["Overview", "Content", "Configuration", "You"])
    expect(
      within(screen.getByRole("banner")).getByRole("link", {
        name: "View site (opens in new tab)",
      })
    ).toHaveAttribute("target", "_blank")
  })
})
