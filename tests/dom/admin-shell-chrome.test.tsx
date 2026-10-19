import { act, render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { toast } from "sonner"
import { afterEach, describe, expect, it, vi } from "vitest"

// MK parity A3: brand chip, the topbar Enquiries link, the identity block
// on the account trigger and top-centre toasts.
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))
vi.mock("next/link", () => ({
  default: ({ href, ...props }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props} />
  ),
}))
vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: vi.fn() },
  authErrorMessage: () => "Could not sign out.",
}))

import { AdminProviders, makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import { BrandMark } from "@/components/admin/shell/brand-mark"
import type { NavBadges } from "@/lib/admin/nav"
import type { Role } from "@/lib/auth/roles"

function renderShell({
  roles,
  badges,
  user = { name: "Edith Editor", email: "edith@example.test" },
}: {
  roles: Role[]
  badges?: NavBadges
  user?: { name: string; email: string }
}) {
  return render(
    <AdminShell
      queryClient={makeQueryClient()}
      badges={badges}
      session={{
        user: { id: "u1", title: null, twoFactorEnabled: false, ...user },
        roles,
        impersonatedBy: null,
      }}
    >
      <p>Body</p>
    </AdminShell>
  )
}

describe("topbar Enquiries link", () => {
  it("shows the new-leads count for lead readers", () => {
    renderShell({ roles: ["intake"], badges: { "new-leads": 3 } })
    const topbar = screen.getByRole("banner")
    const link = within(topbar).getByRole("link", {
      name: "Enquiries, 3 new unassigned",
    })
    expect(link).toHaveAttribute("href", "/admin/leads")
    // Same count as the sidebar's Leads badge.
    expect(link).toHaveTextContent("3")
    // Phones rely on the sidebar's Leads badge: the topbar keeps room for search.
    expect(link).toHaveClass("hidden", "sm:inline-flex")
  })

  it("keeps the search pill a 44 px target on narrow phones", () => {
    renderShell({ roles: ["intake"], badges: { "new-leads": 3 } })
    const pill = within(screen.getByRole("banner")).getByRole("button", {
      name: "Search",
    })
    expect(pill).toHaveClass("h-11", "min-w-11")
    expect(pill).not.toHaveClass("min-w-0")
  })

  it("is a plain Enquiries link with no new leads", () => {
    renderShell({ roles: ["intake"] })
    const link = within(screen.getByRole("banner")).getByRole("link", {
      name: "Enquiries",
    })
    expect(link.querySelector("[data-slot=enquiries-count]")).toBeNull()
  })

  it("caps a large count like the sidebar badge", () => {
    renderShell({ roles: ["owner"], badges: { "new-leads": 250 } })
    expect(
      screen.getByRole("link", { name: "Enquiries, 250 new unassigned" })
    ).toHaveTextContent("99+")
  })

  it("hides without lead:read", () => {
    renderShell({ roles: ["editor"], badges: { "new-leads": 3 } })
    expect(screen.queryByRole("link", { name: /Enquiries/ })).toBeNull()
  })
})

describe("account trigger identity", () => {
  it("names the person, email and primary role", () => {
    renderShell({
      roles: ["editor", "owner"],
      user: { name: "Ann Owner", email: "ann@x.ie" },
    })
    const trigger = screen.getByRole("button", {
      name: "Account menu for Ann Owner",
    })
    expect(trigger).toHaveTextContent("ann@x.ie")
    // Highest role in ROLES order, by its label.
    const role = trigger.querySelector("[data-slot=role-pill]")
    expect(role).toHaveTextContent(/^Owner$/)
  })

  it("keeps the avatar and hides the text block below lg", () => {
    renderShell({
      roles: ["owner"],
      user: { name: "Ann Owner", email: "a@x.ie" },
    })
    const trigger = screen.getByRole("button", { name: /Ann Owner/ })
    expect(trigger.querySelector("[data-slot=avatar]")).not.toBeNull()
    expect(trigger.querySelector("[data-slot=user-identity]")).toHaveClass(
      "hidden",
      "lg:flex"
    )
  })
})

describe("brand chip", () => {
  it("is a round accent chip with the SP mark", () => {
    const { container } = render(<BrandMark />)
    const chip = container.querySelector("[data-slot=brand-chip]")
    expect(chip).toHaveClass(
      "size-10",
      "rounded-full",
      "bg-accent",
      "text-accent-foreground"
    )
    const svg = chip!.querySelector("svg")
    expect(svg).toHaveAttribute("aria-hidden", "true")
    expect(container.querySelector("img")).toBeNull()
    // Letters are paths: no runtime font.
    expect(svg!.querySelector("text")).toBeNull()
    expect(
      [...svg!.querySelectorAll("mask path")].map((p) =>
        p.getAttribute("data-glyph")
      )
    ).toEqual(["S", "P"])
    expect(container).toHaveTextContent("Security Partners")
  })
})

describe("toasts", () => {
  it("are top-centre, below the topbar", async () => {
    render(
      <AdminProviders cacheKey="chrome" client={makeQueryClient()}>
        {null}
      </AdminProviders>
    )
    act(() => {
      toast.success("Saved")
    })
    await screen.findByText("Saved")
    const list = document.querySelector("[data-sonner-toaster]")!
    expect(list).toHaveAttribute("data-y-position", "top")
    expect(list).toHaveAttribute("data-x-position", "center")
    // Both offsets follow the header's measured bottom (fallback 96 px).
    const style = (list as HTMLElement).style
    expect(style.getPropertyValue("--offset-top")).toBe(
      "var(--admin-toast-top, 96px)"
    )
    expect(style.getPropertyValue("--mobile-offset-top")).toBe(
      "var(--admin-toast-top, 96px)"
    )
  })
})

describe("toast anchor", () => {
  const rect = HTMLElement.prototype.getBoundingClientRect
  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = rect
  })

  function headerBottom(bottom: number) {
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      return this.dataset.slot === "admin-header"
        ? ({ bottom } as DOMRect)
        : rect.call(this)
    }
  }

  it("puts toasts 8 px below the header, impersonation banner included", () => {
    headerBottom(147.5)
    const { unmount } = render(
      <AdminShell
        queryClient={makeQueryClient()}
        session={{
          user: {
            id: "u1",
            name: "Ann",
            email: "a@x.ie",
            title: null,
            twoFactorEnabled: false,
          },
          roles: ["owner"],
          impersonatedBy: "u0",
        }}
      >
        <p>Body</p>
      </AdminShell>
    )
    const root = document.documentElement.style
    expect(root.getPropertyValue("--admin-toast-top")).toBe("156px")
    unmount()
    expect(root.getPropertyValue("--admin-toast-top")).toBe("")
  })

  it("writes the variable only when the value changes", () => {
    headerBottom(84)
    const spy = vi.spyOn(CSSStyleDeclaration.prototype, "setProperty")
    renderShell({ roles: ["owner"] })
    const writes = () =>
      spy.mock.calls.filter(([name]) => name === "--admin-toast-top").length
    expect(writes()).toBe(1)
    act(() => {
      window.dispatchEvent(new Event("resize"))
      window.dispatchEvent(new Event("resize"))
    })
    expect(writes()).toBe(1)
    headerBottom(100)
    act(() => {
      window.dispatchEvent(new Event("resize"))
    })
    expect(writes()).toBe(2)
    expect(
      document.documentElement.style.getPropertyValue("--admin-toast-top")
    ).toBe("108px")
    spy.mockRestore()
  })

  it("keeps at least 8 px under a phone topbar", () => {
    // 12 px gutter + 72 px topbar.
    headerBottom(84)
    renderShell({ roles: ["owner"] })
    expect(
      document.documentElement.style.getPropertyValue("--admin-toast-top")
    ).toBe("92px")
  })
})
