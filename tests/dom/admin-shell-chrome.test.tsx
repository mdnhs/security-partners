import { act, render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { toast } from "sonner"
import { describe, expect, it, vi } from "vitest"

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
import type { NavBadges } from "@/components/admin/shell/nav"
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
    const link = within(topbar).getByRole("link", { name: "Enquiries, 3 new" })
    expect(link).toHaveAttribute("href", "/admin/leads")
    // Same count as the sidebar's Leads badge.
    expect(link).toHaveTextContent("3")
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
      screen.getByRole("link", { name: "Enquiries, 250 new" })
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
    // Desktop 80 px, phone 72 px: below the topbar's icon buttons.
    const style = (list as HTMLElement).style
    expect(style.getPropertyValue("--offset-top")).toBe("80px")
    expect(style.getPropertyValue("--mobile-offset-top")).toBe("72px")
  })
})
