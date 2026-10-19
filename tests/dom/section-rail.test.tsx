import { render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
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

import {
  SectionTabs,
  SectionTabsPanel,
  useInSectionTabs,
} from "@/components/admin/section-tabs/section-tabs"
import { AdminSessionProvider } from "@/components/admin/session-provider"
import {
  SectionRail,
  useInSectionRail,
} from "@/components/admin/shell/section-rail"
import type { Role } from "@/lib/auth/roles"

function renderAt(path: string, roles: Role[], body = <p>Body</p>) {
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
      <SectionRail>{body}</SectionRail>
    </AdminSessionProvider>
  )
}

const links = (name: string) =>
  within(screen.getByRole("navigation", { name }))
    .getAllByRole("link")
    .map((link) => link.textContent)

afterEach(() => {
  pathname.current = "/admin"
})

describe("SectionRail", () => {
  it("renders a labelled rail with the active child for SEO", () => {
    renderAt("/admin/seo/redirects", ["owner"])
    const rail = screen.getByRole("navigation", { name: "SEO" })
    expect(
      within(rail).getByRole("link", { name: "Redirects" })
    ).toHaveAttribute("aria-current", "page")
    expect(
      within(rail).getByRole("link", { name: "Overview" })
    ).not.toHaveAttribute("aria-current")
    expect(links("SEO")).toEqual(["Overview", "Defaults", "Redirects"])
    expect(screen.getByText("Body")).toBeInTheDocument()
  })

  it("captions the rail with the section label (uppercase, muted)", () => {
    renderAt("/admin/seo", ["owner"])
    const caption = within(
      screen.getByRole("navigation", { name: "SEO" })
    ).getByText("SEO")
    expect(caption).toHaveClass(
      "text-[11px]",
      "font-semibold",
      "tracking-wider",
      "text-muted-foreground",
      "uppercase"
    )
  })

  it("lists only the children the role may open", () => {
    renderAt("/admin/seo/defaults", ["editor"])
    expect(links("SEO")).toEqual(["Overview", "Defaults"])
  })

  it("shows the Site settings rail for a viewer", () => {
    renderAt("/admin/settings/site", ["viewer"])
    const rail = screen.getByRole("navigation", { name: "Site settings" })
    expect(
      within(rail).getByRole("link", { name: "Identity" })
    ).toHaveAttribute("aria-current", "page")
    expect(links("Site settings")).not.toContain("Integrations")
  })

  it("shows the Marketing rail for a marketer", () => {
    renderAt("/admin/marketing/consent", ["marketer"])
    const rail = screen.getByRole("navigation", { name: "Marketing" })
    expect(
      within(rail).getByRole("link", { name: "Consent banner" })
    ).toHaveAttribute("aria-current", "page")
  })

  it("no rail when only one child is visible (author: Articles only)", () => {
    renderAt("/admin/insights", ["author"])
    expect(screen.queryByRole("navigation", { name: "Insights" })).toBeNull()
    expect(screen.getByText("Body")).toBeInTheDocument()
  })

  it("no rail on a section without children", () => {
    renderAt("/admin/pages", ["owner"])
    expect(screen.queryByRole("navigation")).toBeNull()
    expect(screen.getByText("Body")).toBeInTheDocument()
  })

  it("an article (/admin/insights/<id>) keeps Articles current", () => {
    renderAt("/admin/insights/0192abcd", ["editor"])
    const rail = screen.getByRole("navigation", { name: "Insights" })
    expect(
      within(rail).getByRole("link", { name: "Articles" })
    ).toHaveAttribute("aria-current", "page")
  })

  it("an integration page keeps Integrations current", () => {
    renderAt("/admin/settings/integrations/smtp", ["owner"])
    const rail = screen.getByRole("navigation", { name: "Site settings" })
    expect(
      within(rail).getByRole("link", { name: "Integrations" })
    ).toHaveAttribute("aria-current", "page")
  })

  it("content is not wrapped in a card", () => {
    renderAt("/admin/seo", ["owner"])
    const content = document.querySelector("[data-slot=section-content]")
    expect(content).not.toBeNull()
    expect(content).not.toHaveClass("bg-card")
    expect(content).toHaveClass("min-w-0", "flex-1")
  })

  it("rail links are 44 px tall below lg (touch)", () => {
    renderAt("/admin/seo", ["owner"])
    for (const link of within(
      screen.getByRole("navigation", { name: "SEO" })
    ).getAllByRole("link"))
      expect(link).toHaveClass("min-h-11")
  })

  it("tells the page it sits beside the rail, not on a card", () => {
    const seen: [boolean, boolean][] = []
    function Probe() {
      seen.push([useInSectionRail(), useInSectionTabs()])
      return null
    }
    renderAt("/admin/seo", ["owner"], <Probe />)
    expect(seen.at(-1)).toEqual([true, false])
  })

  it("nested in-page tabs drop to the xl column and stay off a card", () => {
    renderAt(
      "/admin/settings/site",
      ["owner"],
      <SectionTabs
        ariaLabel="Groups"
        items={[
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ]}
      >
        <SectionTabsPanel id="a">Panel A</SectionTabsPanel>
        <SectionTabsPanel id="b">Panel B</SectionTabsPanel>
      </SectionTabs>
    )
    const inner = screen
      .getByText("Panel A")
      .closest('[data-slot="section-tabs-content"]')
    expect(inner).not.toHaveClass("bg-card")
    expect(
      screen.getByRole("tablist", { name: "Groups" }).parentElement
    ).toHaveClass("xl:w-52")
  })
})
