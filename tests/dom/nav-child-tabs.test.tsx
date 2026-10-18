import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/seo/defaults",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import { AdminSessionProvider } from "@/components/admin/session-provider"
import { NavChildTabs } from "@/components/admin/shell/nav-child-tabs"
import type { Role } from "@/lib/auth/roles"

const renderAs = (roles: Role[], basePath: string) =>
  render(
    <AdminSessionProvider
      value={{
        user: {
          id: "u",
          name: "U",
          email: "u@x.test",
          title: null,
          twoFactorEnabled: true,
        },
        roles,
        impersonatedBy: null,
      }}
    >
      <NavChildTabs basePath={basePath}>
        <p>Body</p>
      </NavChildTabs>
    </AdminSessionProvider>
  )

describe("NavChildTabs", () => {
  it("finds the section by address and lists the sub-pages a role may open", () => {
    renderAs(["editor"], "/admin/seo")
    const tabs = screen.getByRole("navigation", { name: "SEO" })
    expect(
      within(tabs)
        .getAllByRole("link")
        .map((link) => link.textContent)
    ).toEqual(["Overview", "Defaults"])
    expect(
      within(tabs).getByRole("link", { name: "Defaults" })
    ).toHaveAttribute("aria-current", "page")
    expect(screen.getByText("Body")).toBeInTheDocument()
  })

  it("renders the page alone when no section owns the address", () => {
    renderAs(["owner"], "/admin/nowhere")
    expect(screen.queryByRole("navigation")).toBeNull()
    expect(screen.getByText("Body")).toBeInTheDocument()
  })
})
