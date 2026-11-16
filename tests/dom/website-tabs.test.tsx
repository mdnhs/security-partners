import { render, screen, within } from "@testing-library/react"
import type { ComponentProps, ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/admin" } }))
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("next/link", () => ({
  default: ({ href, ...props }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props} />
  ),
}))

import { AdminSessionProvider } from "@/components/admin/session-provider"
import { WebsiteTabs } from "@/components/admin/website/website-tabs"
import type { Role } from "@/lib/auth/roles"

function renderAt(path: string, roles: Role[], body: ReactNode) {
  pathname.current = path
  return render(
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
      {body}
    </AdminSessionProvider>
  )
}

afterEach(() => {
  pathname.current = "/admin"
})

describe("WebsiteTabs", () => {
  it("lists Header & footer's parts, the current one marked", () => {
    renderAt(
      "/admin/website/header-footer/footer",
      ["owner"],
      <WebsiteTabs screen="header-footer" />
    )
    const nav = screen.getByRole("navigation", {
      name: "Header & footer sections",
    })
    expect(
      within(nav)
        .getAllByRole("link")
        .map((l) => l.textContent)
    ).toEqual(["Header menu", "Footer", "Forms & microcopy", "Group companies"])
    expect(within(nav).getByRole("link", { name: "Footer" })).toHaveAttribute(
      "aria-current",
      "page"
    )
  })

  it("renders nothing on a page whose sections sit in its form (Home)", () => {
    const { container } = renderAt(
      "/admin/website/home",
      ["owner"],
      <WebsiteTabs screen="home" />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing on the services list (All services is not a tab)", () => {
    const { container } = renderAt(
      "/admin/services",
      ["owner"],
      <WebsiteTabs screen="services" />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing for an author on Blog (one tab)", () => {
    const { container } = renderAt(
      "/admin/insights",
      ["author"],
      <WebsiteTabs screen="blog" />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("marks Categories, not Articles, on /admin/insights/categories", () => {
    renderAt(
      "/admin/insights/categories",
      ["owner"],
      <WebsiteTabs screen="blog" />
    )
    const nav = screen.getByRole("navigation", { name: "Blog sections" })
    expect(
      within(nav)
        .getAllByRole("link")
        .map((l) => l.textContent)
    ).toEqual(["Page", "Articles", "Categories"])
    expect(
      within(nav).getByRole("link", { name: "Categories" })
    ).toHaveAttribute("aria-current", "page")
    expect(
      within(nav).getByRole("link", { name: "Articles" })
    ).not.toHaveAttribute("aria-current")
  })
})
