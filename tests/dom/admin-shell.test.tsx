import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Inbox } from "lucide-react"
import type { ComponentProps } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
import { formatBadge, NavEntry } from "@/components/admin/shell/nav-entry"
import { AdminThemeProvider } from "@/components/admin/theme-provider"
import { SidebarProvider } from "@/components/ui/sidebar"
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

const desktopWidth = window.innerWidth
/** useIsMobile reads innerWidth on mount (< 1024 px: the sheet). */
function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  })
}

afterEach(() => {
  setViewportWidth(desktopWidth)
  document.cookie = "sidebar_state=; max-age=0; path=/admin"
})

beforeEach(() => {
  pathname.current = "/admin"
  router.replace.mockReset()
  router.refresh.mockReset()
  signOut.mockReset()
})

describe("AdminShell (master 4.1)", () => {
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

  it("opens the navigation in a sheet on small screens and closes it on navigation", async () => {
    setViewportWidth(390)
    const user = userEvent.setup()
    render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    const trigger = within(screen.getByRole("banner")).getByRole("button", {
      name: "Toggle navigation",
    })
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    await user.click(trigger)
    const sheet = await screen.findByRole("dialog", { name: "Navigation" })
    await user.click(within(sheet).getByRole("link", { name: "Services" }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Navigation" })).toBeNull()
    )
  })

  it("collapses the desktop sidebar from the header trigger and Ctrl/⌘+B", async () => {
    const user = userEvent.setup()
    render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    const sidebar = document.querySelector('[data-slot="sidebar"]')!
    expect(sidebar).toHaveAttribute("data-state", "expanded")
    const trigger = screen.getByRole("button", { name: "Toggle navigation" })
    // The desktop sidebar never leaves the page: nothing to "expand".
    expect(trigger).not.toHaveAttribute("aria-expanded")
    await user.click(trigger)
    expect(sidebar).toHaveAttribute("data-state", "collapsed")
    expect(sidebar).toHaveAttribute("data-collapsible", "icon")
    await user.keyboard("{Control>}b{/Control}")
    expect(sidebar).toHaveAttribute("data-state", "expanded")
    await user.keyboard("{Meta>}b{/Meta}")
    expect(sidebar).toHaveAttribute("data-state", "collapsed")
  })

  it("leaves Ctrl/⌘+B to text fields, rich text and handlers that claim it", async () => {
    const user = userEvent.setup()
    render(
      <AdminShell session={session(["editor"])}>
        <input aria-label="Title" />
        <div contentEditable suppressContentEditableWarning aria-label="Body">
          <p>Rich</p>
        </div>
        <button
          type="button"
          onKeyDown={(event) => {
            if (event.key === "b") event.preventDefault()
          }}
        >
          Claims bold
        </button>
      </AdminShell>
    )
    const sidebar = document.querySelector('[data-slot="sidebar"]')!
    await user.click(screen.getByRole("textbox", { name: "Title" }))
    await user.keyboard("{Control>}b{/Control}")
    expect(sidebar).toHaveAttribute("data-state", "expanded")
    await user.keyboard("{Meta>}b{/Meta}")
    expect(sidebar).toHaveAttribute("data-state", "expanded")
    fireEvent.keyDown(screen.getByText("Rich"), { key: "b", metaKey: true })
    expect(sidebar).toHaveAttribute("data-state", "expanded")
    fireEvent.keyDown(screen.getByText("Rich"), { key: "b", ctrlKey: true })
    expect(sidebar).toHaveAttribute("data-state", "expanded")
    await user.click(screen.getByRole("button", { name: "Claims bold" }))
    await user.keyboard("{Control>}b{/Control}")
    expect(sidebar).toHaveAttribute("data-state", "expanded")
    // Sanity: the same key on a plain button does toggle.
    fireEvent.keyDown(document.body, { key: "b", ctrlKey: true })
    expect(sidebar).toHaveAttribute("data-state", "collapsed")
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

  it("closes the navigation sheet from its close button", async () => {
    setViewportWidth(390)
    const user = userEvent.setup()
    render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    await user.click(screen.getByRole("button", { name: "Toggle navigation" }))
    const sheet = await screen.findByRole("dialog", { name: "Navigation" })
    const close = within(sheet).getByRole("button", { name: "Close" })
    expect(close).not.toHaveClass("hidden")
    await user.click(close)
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Navigation" })).toBeNull()
    )
  })

  it("closes the navigation sheet from the brand link too", async () => {
    setViewportWidth(390)
    const user = userEvent.setup()
    render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    await user.click(screen.getByRole("button", { name: "Toggle navigation" }))
    const sheet = await screen.findByRole("dialog", { name: "Navigation" })
    await user.click(
      within(sheet).getByRole("link", { name: /Security Partners/ })
    )
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Navigation" })).toBeNull()
    )
  })

  it("labels production as Live", () => {
    render(
      <AdminShell
        session={session(["editor"])}
        site={{ url: "https://example.test", env: "production" }}
      >
        <p>Body</p>
      </AdminShell>
    )
    expect(
      document.querySelector('[data-slot="sidebar-footer"]')
    ).toHaveTextContent("Live")
  })

  it("starts collapsed when the saved sidebar state says so", () => {
    render(
      <AdminShell session={session(["editor"])} defaultSidebarOpen={false}>
        <p>Body</p>
      </AdminShell>
    )
    expect(document.querySelector('[data-slot="sidebar"]')).toHaveAttribute(
      "data-state",
      "collapsed"
    )
  })

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
    ).toEqual(["Dashboard"])
    expect(screen.getByRole("main")).toHaveTextContent("Body")
  })

  it("lists sections only and marks Collections on a collection page", () => {
    pathname.current = "/admin/clients"
    render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    const nav = screen.getByRole("navigation", { name: "Admin" })
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.textContent)
    ).toEqual([
      "Dashboard",
      "Pages",
      "Articles",
      "Services",
      "Collections",
      "Settings",
    ])
    const collections = within(nav).getByRole("link", { name: "Collections" })
    expect(collections).toHaveAttribute("aria-current", "page")
    expect(collections).toHaveAttribute("href", "/admin/team")
  })

  it("puts the floating panels on the canvas: sidebar, topbar, content", () => {
    render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    const sidebar = document.querySelector('[data-slot="sidebar"]')!
    expect(sidebar).toHaveAttribute("data-variant", "floating")
    const topbar = screen.getByRole("banner")
    expect(topbar).toHaveAttribute("data-slot", "topbar")
    expect(topbar).toHaveClass("rounded-card", "bg-sidebar", "h-[72px]")
    const main = screen.getByRole("main")
    expect(main).toHaveClass("rounded-card", "bg-sidebar", "overflow-y-auto")
    expect(main).toHaveAttribute("id", "main")
    expect(
      screen.getByRole("link", { name: "Skip to content" })
    ).toHaveAttribute("href", "#main")
  })

  it("opens ⌘K from the search pill", async () => {
    const user = userEvent.setup()
    render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    const pill = within(screen.getByRole("banner")).getByRole("button", {
      name: "Search",
    })
    expect(pill).toHaveAttribute("aria-keyshortcuts", "Meta+K Control+K")
    await user.click(pill)
    expect(
      await screen.findByRole("dialog", { name: "Search the admin" })
    ).toBeInTheDocument()
  })

  it("shows an honest empty notifications popover", async () => {
    const user = userEvent.setup()
    render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    await user.click(
      within(screen.getByRole("banner")).getByRole("button", {
        name: "Notifications",
      })
    )
    expect(await screen.findByText("No notifications yet")).toBeInTheDocument()
  })

  it("user menu in the topbar: identity, roles, Account, Security, theme, sign out", async () => {
    const user = userEvent.setup()
    render(
      <AdminThemeProvider defaultTheme="light">
        <AdminShell session={session(["editor", "author"])}>
          <p>Body</p>
        </AdminShell>
      </AdminThemeProvider>
    )
    const trigger = within(screen.getByRole("banner")).getByRole("button", {
      name: "Account menu for Edith Editor",
    })
    expect(trigger).toHaveTextContent("EE")
    await user.click(trigger)
    const menu = await screen.findByRole("menu")
    expect(menu).toHaveTextContent("Edith Editor")
    expect(menu).toHaveTextContent("edith@example.test")
    expect(menu).toHaveTextContent("editor, author")
    expect(
      within(menu).getByRole("menuitem", { name: "Account" })
    ).toHaveAttribute("href", "/admin/account")
    expect(
      within(menu).getByRole("menuitem", { name: "Security" })
    ).toHaveAttribute("href", "/admin/account?tab=security")
    expect(
      within(menu)
        .getAllByRole("menuitemradio")
        .map((item) => item.textContent)
    ).toEqual(["Light", "Dark", "System"])
    await user.click(within(menu).getByRole("menuitemradio", { name: "Dark" }))
    await waitFor(() =>
      expect(localStorage.getItem("sp-admin-theme")).toBe("dark")
    )
  })

  it("stacks the impersonation banner above the topbar in one header wrapper", () => {
    render(
      <AdminShell session={session(["editor"], "owner-1")}>
        <p>Body</p>
      </AdminShell>
    )
    const banner = screen.getByRole("region", { name: "Impersonation" })
    const topbar = screen.getByRole("banner")
    const header = topbar.parentElement!
    expect(header).toHaveAttribute("data-slot", "admin-header")
    expect(header.firstElementChild).toBe(banner)
    // The sidebar sits beside the content column, never under the header.
    const sidebar = document.querySelector('[data-slot="sidebar"]')!
    expect(sidebar.contains(header)).toBe(false)
    expect(header.contains(sidebar)).toBe(false)
    expect(header.nextElementSibling).toBe(screen.getByRole("main"))
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
      screen.getByRole("button", { name: "Account menu for Edith Editor" })
    )
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }))
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        "/admin/sign-in?notice=signed-out"
      )
    )
    expect(clear).toHaveBeenCalled()
  })

  it("shows a sign-out failure in the topbar, clears it on reopen and keeps the session", async () => {
    signOut.mockResolvedValue({ error: { message: "nope" } })
    const client = makeQueryClient()
    const clear = vi.spyOn(client, "clear")
    const user = userEvent.setup()
    render(
      <AdminShell session={session(["editor"])} queryClient={client}>
        <p>Body</p>
      </AdminShell>
    )
    const account = screen.getByRole("button", {
      name: "Account menu for Edith Editor",
    })
    await user.click(account)
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }))
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Could not sign out.")
    expect(screen.queryByRole("menu")).toBeNull()
    expect(alert.closest('[data-slot="topbar"]')).not.toBeNull()
    expect(clear).not.toHaveBeenCalled()
    expect(router.replace).not.toHaveBeenCalled()
    await user.click(account)
    expect(
      await screen.findByRole("menuitem", { name: "Sign out" })
    ).not.toHaveAttribute("aria-disabled", "true")
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("footer dock: Account link and Log out (which clears the cache)", async () => {
    signOut.mockResolvedValue({ error: null })
    const client = makeQueryClient()
    const clear = vi.spyOn(client, "clear")
    const user = userEvent.setup()
    render(
      <AdminShell session={session(["intake"])} queryClient={client}>
        <p>Body</p>
      </AdminShell>
    )
    const footer = document.querySelector(
      '[data-slot="sidebar-footer"]'
    ) as HTMLElement
    // The card's dock row and the icon rail's column (CSS shows one).
    const docks = within(footer).getAllByRole("navigation", {
      name: "Administration",
    })
    expect(docks).toHaveLength(2)
    expect(
      within(docks[0]).getByRole("link", { name: "Account" })
    ).toHaveAttribute("href", "/admin/account")
    await user.click(within(docks[0]).getByRole("button", { name: "Log out" }))
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        "/admin/sign-in?notice=signed-out"
      )
    )
    expect(clear).toHaveBeenCalled()
  })

  it("dock: a failed sign-out shows beside the dock, readable in the icon rail", async () => {
    signOut.mockResolvedValue({ error: { message: "nope" } })
    const user = userEvent.setup()
    render(
      <AdminShell session={session(["editor"])} defaultSidebarOpen={false}>
        <p>Body</p>
      </AdminShell>
    )
    const footer = document.querySelector(
      '[data-slot="sidebar-footer"]'
    ) as HTMLElement
    const [, rail] = within(footer).getAllByRole("navigation", {
      name: "Administration",
    })
    await user.click(within(rail).getByRole("button", { name: "Log out" }))
    const alert = await within(footer).findByRole("alert")
    expect(alert).toHaveTextContent("Could not sign out.")
    // Floats beside the rail instead of turning sr-only.
    expect(alert.className).not.toMatch(/sr-only/)
    expect(alert).toHaveClass("group-data-[collapsible=icon]:absolute")
    // Only the control that failed shows it (not the topbar too).
    expect(screen.getAllByRole("alert")).toHaveLength(1)
    expect(router.replace).not.toHaveBeenCalled()
  })

  it("one sign-out at a time: a pending dock sign-out disables the menu's", async () => {
    signOut.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    const footer = document.querySelector(
      '[data-slot="sidebar-footer"]'
    ) as HTMLElement
    const [card] = within(footer).getAllByRole("navigation", {
      name: "Administration",
    })
    await user.click(within(card).getByRole("button", { name: "Log out" }))
    expect(within(card).getByRole("button", { name: "Log out" })).toBeDisabled()
    await user.click(
      screen.getByRole("button", { name: "Account menu for Edith Editor" })
    )
    expect(
      await screen.findByRole("menuitem", { name: "Sign out" })
    ).toHaveAttribute("aria-disabled", "true")
  })

  it("starts each new page at the top of the scrolling content panel", () => {
    const { rerender } = render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    const main = screen.getByRole("main")
    main.scrollTop = 400
    expect(main.scrollTop).toBe(400)
    pathname.current = "/admin/pages"
    rerender(
      <AdminShell session={session(["editor"])}>
        <p>Pages</p>
      </AdminShell>
    )
    expect(main.scrollTop).toBe(0)
  })

  it("leaves the scroll to the browser when the URL has a #fragment", () => {
    const { rerender } = render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    const main = screen.getByRole("main")
    main.scrollTop = 400
    window.location.hash = "#faq"
    try {
      pathname.current = "/admin/pages"
      rerender(
        <AdminShell session={session(["editor"])}>
          <p>Pages</p>
        </AdminShell>
      )
      expect(main.scrollTop).toBe(400)
    } finally {
      window.location.hash = ""
    }
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
    ).toEqual(["Overview", "Content", "Configuration"])
  })

  it("website card: environment, host and Open site", () => {
    render(
      <AdminShell
        session={session(["editor"])}
        site={{ url: "https://example.test", env: "staging" }}
      >
        <p>Body</p>
      </AdminShell>
    )
    const footer = document.querySelector(
      '[data-slot="sidebar-footer"]'
    ) as HTMLElement
    expect(footer).toHaveTextContent("Your website")
    expect(footer).toHaveTextContent("example.test")
    expect(footer).toHaveTextContent("Staging")
    expect(footer).not.toHaveTextContent("Live")
    const link = within(footer).getByRole("link", {
      name: "Open site (opens in a new tab)",
    })
    expect(link).toHaveAttribute("href", "https://example.test")
    expect(link).toHaveAttribute("target", "_blank")
    // JW topbar: no View site and no breadcrumb.
    expect(
      within(screen.getByRole("banner")).queryByRole("link", {
        name: /View site/,
      })
    ).toBeNull()
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).toBeNull()
  })
})

describe("NavEntry", () => {
  const item = {
    label: "Leads",
    href: "/admin/leads",
    icon: Inbox,
    permission: null,
    match: "prefix" as const,
    badge: "new-leads" as const,
  }
  const renderEntry = (badge?: number) =>
    render(
      <SidebarProvider>
        <ul>
          <NavEntry item={item} active={false} badge={badge} />
        </ul>
      </SidebarProvider>
    )

  it("shows a count badge with an accessible label", () => {
    renderEntry(3)
    expect(screen.getByRole("img", { name: "3 new leads" })).toHaveTextContent(
      "3"
    )
  })

  it("caps the badge at 99+ and hides it at zero", () => {
    const { unmount } = renderEntry(120)
    expect(
      screen.getByRole("img", { name: "120 new leads" })
    ).toHaveTextContent("99+")
    unmount()
    renderEntry(0)
    expect(screen.queryByRole("img")).toBeNull()
    expect(formatBadge(7)).toBe("7")
  })

  it("marks the active entry with a bar, bold label and filled icon", () => {
    render(
      <SidebarProvider>
        <ul>
          <NavEntry item={item} active />
        </ul>
      </SidebarProvider>
    )
    const link = screen.getByRole("link", { name: "Leads" })
    expect(link).toHaveAttribute("aria-current", "page")
    expect(link).toHaveAttribute("data-active")
    expect(
      link.closest("li")!.querySelector('[data-slot="nav-active-bar"]')
    ).not.toBeNull()
  })
})
