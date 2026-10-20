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
    // A click passes no replace hint.
    expect(onValueChange).toHaveBeenCalledWith("profile", undefined)
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

describe("SectionTabs (JW look)", () => {
  it("JW look: active tab on the accent fill with a semibold label", () => {
    render(
      <SectionTabs
        ariaLabel="Account"
        items={[
          { id: "profile", label: "Profile" },
          { id: "security", label: "Security" },
        ]}
        value="security"
      >
        <SectionTabsPanel id="profile">Profile body</SectionTabsPanel>
        <SectionTabsPanel id="security">Security body</SectionTabsPanel>
      </SectionTabs>
    )
    const active = screen.getByRole("tab", { name: "Security" })
    expect(active).toHaveClass("bg-sidebar-accent", "font-semibold")
    expect(screen.getByRole("tab", { name: "Profile" })).not.toHaveClass(
      "bg-sidebar-accent"
    )
  })

  it("shows the section caption above the list, hidden from assistive tech", () => {
    render(
      <SectionTabs
        ariaLabel="Settings"
        heading="Settings"
        items={[
          { id: "a", label: "Site", href: "/admin/settings/site" },
          { id: "b", label: "Footer", href: "/admin/settings/footer" },
        ]}
      >
        <p>Body</p>
      </SectionTabs>
    )
    const nav = screen.getByRole("navigation", { name: "Settings" })
    const caption = within(nav).getByText("Settings", { selector: "p" })
    expect(caption).toHaveAttribute("aria-hidden", "true")
    expect(caption).toHaveClass("uppercase")
  })

  it("keeps the 13 rem column (JW lg:w-52)", () => {
    render(
      <SectionTabs
        ariaLabel="Settings"
        items={[{ id: "a", label: "Site", href: "/admin/settings/site" }]}
      >
        <p>Body</p>
      </SectionTabs>
    )
    expect(screen.getByRole("navigation", { name: "Settings" })).toHaveClass(
      "lg:w-52"
    )
  })
})

describe("SectionTabs (Task 14 polish)", () => {
  const desktopWidth = window.innerWidth
  afterEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: desktopWidth,
    })
    vi.restoreAllMocks()
  })

  it("reports a horizontal tablist below lg (the scrolling row)", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 800,
    })
    render(<InPage />)
    expect(screen.getByRole("tablist")).toHaveAttribute(
      "aria-orientation",
      "horizontal"
    )
  })

  it("nested tabs stay horizontal until xl", () => {
    render(
      <SectionTabs
        ariaLabel="Outer"
        items={[{ id: "a", label: "A", href: "/admin/settings/contact" }]}
      >
        <InPage />
      </SectionTabs>
    )
    expect(
      screen.getByRole("tablist", { name: "Account sections" })
    ).toHaveAttribute("aria-orientation", "horizontal")
  })

  it("pushes a history entry for a click, replaces it for arrow keys", async () => {
    const user = userEvent.setup()
    const push = vi.spyOn(window.history, "pushState")
    const replace = vi.spyOn(window.history, "replaceState")
    render(<InPage />)
    await user.click(screen.getByRole("tab", { name: /^Password/ }))
    expect(push).toHaveBeenCalledTimes(1)
    expect(window.location.search).toBe("?tab=password")
    await user.keyboard("{ArrowDown}")
    expect(push).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledTimes(1)
    expect(window.location.search).toBe("?tab=sessions")
  })

  it("passes the replace hint to a controlled onValueChange for keys only", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<InPage value="profile" onValueChange={onValueChange} />)
    screen.getByRole("tab", { name: "Profile" }).focus()
    await user.keyboard("{ArrowDown}")
    expect(onValueChange).toHaveBeenLastCalledWith("password", {
      replace: true,
    })
  })
})

describe("SectionTabs (sticky rail)", () => {
  it("keeps the rail in view from lg while the content scrolls", () => {
    render(
      <SectionTabs
        ariaLabel="Settings"
        items={[{ id: "a", label: "Site", href: "/admin/settings/site" }]}
      >
        <p>Body</p>
      </SectionTabs>
    )
    expect(screen.getByRole("navigation", { name: "Settings" })).toHaveClass(
      "lg:sticky",
      "lg:top-[var(--section-tabs-top,0px)]",
      "lg:self-start",
      "lg:overflow-y-auto",
      // Capped to the visible panel: its measured height (impersonation
      // banner included) less main's padding top and bottom.
      "lg:max-h-[calc(var(--main-h,var(--content-h,100svh))-2*var(--main-pad,0px)-var(--section-tabs-top,0px))]"
    )
  })

  it("nested rails stick from xl, below the editor bar", () => {
    render(
      <SectionTabs
        ariaLabel="Outer"
        items={[{ id: "a", label: "A", href: "/admin/settings/contact" }]}
      >
        <InPage />
      </SectionTabs>
    )
    const column = screen.getByRole("tablist", {
      name: "Account sections",
    }).parentElement
    expect(column).toHaveClass(
      "xl:sticky",
      "xl:top-[var(--section-tabs-top,0px)]"
    )
    expect(column).not.toHaveClass("lg:sticky")
  })
})

describe("SectionTabs (content surface)", () => {
  it("puts the content on a white card beside the grey rail", () => {
    render(<InPage />)
    const panel = screen.getByRole("tabpanel")
    const card = panel.closest('[data-slot="section-tabs-content"]')
    expect(card).toHaveClass("bg-card", "rounded-card", "p-(--card-pad)")
    // Its padding is a variable an editor bar spans with (no fixed offsets).
    expect(card).toHaveClass("[--card-pad:1rem]", "sm:[--card-pad:1.5rem]")
  })

  it("route mode too; a nested set does not nest a second card", () => {
    render(
      <SectionTabs
        ariaLabel="Outer"
        items={[{ id: "a", label: "A", href: "/admin/settings/contact" }]}
      >
        <InPage />
      </SectionTabs>
    )
    const [outer, inner] = document.querySelectorAll(
      '[data-slot="section-tabs-content"]'
    )
    expect(outer).toHaveClass("bg-card", "rounded-card")
    expect(inner).not.toHaveClass("bg-card")
  })
})
