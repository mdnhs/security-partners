import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { pathname } = vi.hoisted(() => ({
  pathname: { current: "/admin/settings/contact" },
}))
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }))
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

const items = [
  { id: "profile", label: "Profile" },
  { id: "password", label: "Password", error: true },
  { id: "sessions", label: "Sessions", badge: <span>3</span> },
]

function InPage(props: Partial<ComponentProps<typeof SectionTabs>>) {
  return (
    <SectionTabs ariaLabel="Account sections" items={items} {...props}>
      <SectionTabsPanel id="profile">
        <label>
          Name
          <input defaultValue="" />
        </label>
      </SectionTabsPanel>
      <SectionTabsPanel id="password">Password panel</SectionTabsPanel>
      <SectionTabsPanel id="sessions">Sessions panel</SectionTabsPanel>
    </SectionTabs>
  )
}

beforeEach(() => {
  window.history.replaceState(null, "", "/admin/account")
})
afterEach(() => {
  window.history.replaceState(null, "", "/")
})

describe("SectionTabs (in-page)", () => {
  it("renders a vertical tablist with the first tab selected and linked panels", () => {
    render(<InPage />)
    const list = screen.getByRole("tablist", { name: "Account sections" })
    expect(list).toHaveAttribute("aria-orientation", "vertical")
    const tabs = within(list).getAllByRole("tab")
    expect(tabs).toHaveLength(3)
    expect(tabs[0]).toHaveAttribute("aria-selected", "true")
    expect(tabs[0]).toHaveAttribute("tabindex", "0")
    expect(tabs[1]).toHaveAttribute("tabindex", "-1")
    const panel = screen.getByRole("tabpanel")
    expect(panel).toHaveAttribute("aria-labelledby", tabs[0].id)
    expect(tabs[0]).toHaveAttribute("aria-controls", panel.id)
    // Unselected panels stay mounted but hidden.
    expect(screen.getByText("Password panel")).not.toBeVisible()
  })

  it("moves with Arrow Up/Down, Home and End (roving tabindex, selection follows focus)", async () => {
    const user = userEvent.setup()
    render(<InPage />)
    const [profile, password, sessions] = screen.getAllByRole("tab")
    await user.click(profile)
    await user.keyboard("{ArrowDown}")
    expect(password).toHaveFocus()
    expect(password).toHaveAttribute("aria-selected", "true")
    expect(password).toHaveAttribute("tabindex", "0")
    expect(profile).toHaveAttribute("tabindex", "-1")
    expect(screen.getByText("Password panel")).toBeVisible()
    await user.keyboard("{End}")
    expect(sessions).toHaveFocus()
    await user.keyboard("{ArrowDown}")
    expect(profile).toHaveFocus()
    await user.keyboard("{ArrowUp}")
    expect(sessions).toHaveFocus()
    await user.keyboard("{Home}")
    expect(profile).toHaveFocus()
    expect(profile).toHaveAttribute("aria-selected", "true")
  })

  it("keeps panel state while switching tabs", async () => {
    const user = userEvent.setup()
    render(<InPage />)
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Ann")
    await user.click(screen.getByRole("tab", { name: /^Sessions/ }))
    await user.click(screen.getByRole("tab", { name: "Profile" }))
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Ann")
  })

  it("syncs the selected tab with ?tab= (deep link, click, back)", async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, "", "/admin/account?tab=sessions")
    render(<InPage />)
    expect(screen.getByRole("tab", { name: /^Sessions/ })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await user.click(screen.getByRole("tab", { name: /^Password/ }))
    expect(window.location.search).toBe("?tab=password")
    act(() => {
      window.history.replaceState(null, "", "/admin/account?tab=profile")
      window.dispatchEvent(new PopStateEvent("popstate"))
    })
    expect(screen.getByRole("tab", { name: "Profile" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
  })

  it("ignores an unknown ?tab= value", () => {
    window.history.replaceState(null, "", "/admin/account?tab=nope")
    render(<InPage />)
    expect(screen.getByRole("tab", { name: "Profile" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
  })

  it("is controllable through value / onValueChange", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<InPage value="sessions" onValueChange={onValueChange} />)
    expect(screen.getByRole("tab", { name: /^Sessions/ })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await user.click(screen.getByRole("tab", { name: "Profile" }))
    expect(onValueChange).toHaveBeenCalledWith("profile")
    expect(window.location.search).toBe("")
  })

  it("marks errors (dot + screen-reader text) and shows badges", () => {
    render(<InPage />)
    const password = screen.getByRole("tab", { name: "Password, has errors" })
    expect(password).toHaveAttribute("data-error", "true")
    expect(within(password).getByText(", has errors")).toHaveClass("sr-only")
    expect(
      within(screen.getByRole("tab", { name: /^Sessions/ })).getByText("3")
    ).toBeInTheDocument()
  })

  it("is a horizontal scrolling row below lg and a column from lg", () => {
    render(<InPage />)
    const list = screen.getByRole("tablist")
    expect(list).toHaveClass("overflow-x-auto", "lg:flex-col")
    expect(list).not.toHaveClass("flex-col")
  })

  it("nested tabs switch to a column only from xl and report nesting", () => {
    const probe = vi.fn()
    function Probe() {
      probe(useInSectionTabs())
      return null
    }
    render(
      <SectionTabs
        ariaLabel="Outer"
        items={[{ id: "a", label: "A", href: "/admin/settings/contact" }]}
      >
        <SectionTabs ariaLabel="Inner" items={items}>
          <SectionTabsPanel id="profile">
            <Probe />
          </SectionTabsPanel>
        </SectionTabs>
      </SectionTabs>
    )
    expect(probe).toHaveBeenLastCalledWith(true)
    const list = screen.getByRole("tablist", { name: "Inner" })
    expect(list).toHaveClass("xl:flex-col")
    expect(list).not.toHaveClass("lg:flex-col")
  })
})

describe("SectionTabs (route)", () => {
  const routes = [
    { id: "overview", label: "Overview", href: "/admin/settings" },
    { id: "site", label: "Site", href: "/admin/settings/site" },
    {
      id: "contact",
      label: "Contact details",
      href: "/admin/settings/contact",
    },
  ]

  it("renders a nav of links with aria-current on the deepest matching route", () => {
    pathname.current = "/admin/settings/contact"
    render(
      <SectionTabs ariaLabel="Settings" items={routes}>
        <p>Editor</p>
      </SectionTabs>
    )
    const nav = screen.getByRole("navigation", { name: "Settings" })
    expect(within(nav).queryByRole("tablist")).toBeNull()
    expect(
      within(nav).getByRole("link", { name: "Contact details" })
    ).toHaveAttribute("aria-current", "page")
    expect(
      within(nav).getByRole("link", { name: "Overview" })
    ).not.toHaveAttribute("aria-current")
    expect(screen.getByText("Editor")).toBeVisible()
  })

  it("marks the overview on its own path", () => {
    pathname.current = "/admin/settings"
    render(
      <SectionTabs ariaLabel="Settings" items={routes}>
        <p>Overview</p>
      </SectionTabs>
    )
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(screen.getByRole("link", { name: "Site" })).not.toHaveAttribute(
      "aria-current"
    )
  })
})
