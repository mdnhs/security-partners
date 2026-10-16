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
/** useIsMobile reads innerWidth on mount (< 768 px: the sheet). */
function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  })
}

afterEach(() => {
  setViewportWidth(desktopWidth)
  document.cookie = "sidebar_state=; max-age=0; path=/"
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
    await user.click(screen.getByRole("button", { name: "Toggle navigation" }))
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
    screen.getByText("Rich").focus()
    fireEvent.keyDown(screen.getByText("Rich"), { key: "b", metaKey: true })
    await user.click(screen.getByRole("button", { name: "Claims bold" }))
    await user.keyboard("{Control>}b{/Control}")
    expect(sidebar).toHaveAttribute("data-state", "expanded")
  })

  it("shows the signed-in user in the sidebar footer and a skip link", async () => {
    const user = userEvent.setup()
    render(
      <AdminShell session={session(["editor", "author"])}>
        <p>Body</p>
      </AdminShell>
    )
    const account = screen.getByRole("button", { name: /Edith Editor/ })
    expect(account).toHaveTextContent("edith@example.test")
    expect(account).toHaveTextContent("EE")
    expect(account.closest('[data-slot="sidebar-footer"]')).not.toBeNull()
    await user.click(account)
    const menu = await screen.findByRole("menu")
    expect(menu).toHaveTextContent("editor, author")
    expect(
      within(menu).getByRole("menuitem", { name: "Account" })
    ).toHaveAttribute("href", "/admin/account")
    expect(
      within(menu).getByRole("menuitem", { name: "Sign out" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Skip to content" })
    ).toHaveAttribute("href", "#main")
    expect(screen.getByRole("main")).toHaveAttribute("id", "main")
  })

  it("shows where the page sits in the header breadcrumb", () => {
    pathname.current = "/admin/pages/home"
    render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    const crumbs = within(screen.getByRole("banner")).getByRole("navigation", {
      name: "Breadcrumb",
    })
    expect(
      within(crumbs)
        .getAllByRole("listitem")
        .map((li) => li.textContent)
    ).toEqual(["Content", "Pages"])
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

  it("stacks the impersonation banner above the header in one sticky wrapper", () => {
    render(
      <AdminShell session={session(["editor"], "owner-1")}>
        <p>Body</p>
      </AdminShell>
    )
    const banner = screen.getByRole("region", { name: "Impersonation" })
    const siteHeader = screen.getByRole("banner")
    const header = siteHeader.parentElement!
    expect(header).toHaveClass("sticky", "top-0")
    expect(banner.parentElement).toBe(header)
    expect(header.firstElementChild).toBe(banner)
    // Neither sticks on its own (they would overlap at top: 0).
    expect(banner).not.toHaveClass("sticky")
    expect(siteHeader).not.toHaveClass("sticky")
    // The sidebar sits beside the content column, never under the header.
    const sidebar = document.querySelector('[data-slot="sidebar"]')!
    const inset = document.querySelector('[data-slot="sidebar-inset"]')!
    expect(header.parentElement).toBe(inset)
    expect(sidebar.contains(header)).toBe(false)
    expect(header.contains(sidebar)).toBe(false)
    expect(sidebar.parentElement).toBe(inset.parentElement)
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
    await user.click(screen.getByRole("button", { name: /Edith Editor/ }))
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }))
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        "/admin/sign-in?notice=signed-out"
      )
    )
    expect(clear).toHaveBeenCalled()
  })

  it("shows a sign-out failure in the user menu and keeps the session", async () => {
    signOut.mockResolvedValue({ error: { message: "nope" } })
    const client = makeQueryClient()
    const clear = vi.spyOn(client, "clear")
    const user = userEvent.setup()
    render(
      <AdminShell session={session(["editor"])} queryClient={client}>
        <p>Body</p>
      </AdminShell>
    )
    await user.click(screen.getByRole("button", { name: /Edith Editor/ }))
    const item = await screen.findByRole("menuitem", { name: "Sign out" })
    await user.click(item)
    expect(
      within(screen.getByRole("menu")).getByRole("alert")
    ).toHaveTextContent("Could not sign out.")
    expect(item).not.toHaveAttribute("aria-disabled", "true")
    expect(clear).not.toHaveBeenCalled()
    expect(router.replace).not.toHaveBeenCalled()
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

  it("shows the website card with the site host and a View site link", () => {
    render(
      <AdminShell session={session(["editor"])} siteHost="example.test">
        <p>Body</p>
      </AdminShell>
    )
    const footer = document.querySelector(
      '[data-slot="sidebar-footer"]'
    ) as HTMLElement
    expect(footer).toHaveTextContent("Your website")
    expect(footer).toHaveTextContent("example.test")
    // The card's button, and the icon-rail link (CSS shows one at a time).
    const links = within(footer).getAllByRole("link", {
      name: "View site (opens in new tab)",
    })
    expect(links).toHaveLength(2)
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/")
      expect(link).toHaveAttribute("target", "_blank")
    }
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
})
