import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { renderToString } from "react-dom/server"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

/**
 * Next's router as the account tabs meet it: useSearchParams follows every
 * history.pushState / replaceState (Next integrates the native History API,
 * node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md),
 * and a <Link> click navigates by pushing history (no popstate). The server
 * render sees the request's search params (`ssr.search`).
 */
const { history, ssr } = vi.hoisted(() => ({
  history: { listeners: new Set<() => void>() },
  ssr: { search: "" },
}))

vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react")
  const subscribe = (listener: () => void) => {
    history.listeners.add(listener)
    return () => history.listeners.delete(listener)
  }
  return {
    usePathname: () => window.location.pathname,
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
    useSearchParams: () =>
      new URLSearchParams(
        useSyncExternalStore(
          subscribe,
          () => window.location.search,
          () => ssr.search
        )
      ),
  }
})
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
        window.history.pushState(null, "", href)
      }}
    />
  ),
}))

import { AccountTabs } from "@/components/admin/account/account-tabs"
import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"

const native = {
  push: window.history.pushState.bind(window.history),
  replace: window.history.replaceState.bind(window.history),
}
const pushes = vi.fn()
const replaces = vi.fn()
beforeAll(() => {
  window.history.pushState = (...args) => {
    pushes(String(args[2]))
    native.push(...args)
    history.listeners.forEach((listener) => listener())
  }
  window.history.replaceState = (...args) => {
    replaces(String(args[2]))
    native.replace(...args)
    history.listeners.forEach((listener) => listener())
  }
})
afterAll(() => {
  window.history.pushState = native.push
  window.history.replaceState = native.replace
})
beforeEach(() => {
  native.replace(null, "", "/admin/account")
  pushes.mockClear()
  replaces.mockClear()
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ items: [], page: 1, pageSize: 20, total: 0 })
    )
  )
})

const panels = {
  profile: <p>Profile body</p>,
  security: <p>Security body</p>,
  devices: <p>Devices body</p>,
}

const selectedTab = () =>
  within(screen.getByRole("tablist", { name: "Account sections" }))
    .getAllByRole("tab")
    .find((tab) => tab.getAttribute("aria-selected") === "true")?.textContent

describe("AccountTabs (MK B7)", () => {
  it("?tab=security selects the Security tab", () => {
    native.replace(null, "", "/admin/account?tab=security")
    render(<AccountTabs {...panels} />)
    expect(screen.getByRole("tab", { name: "Security" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    expect(screen.getByRole("tab", { name: "Profile" })).toHaveAttribute(
      "aria-selected",
      "false"
    )
    expect(screen.getByText("Security body")).toBeVisible()
  })

  it("server-renders a deep link's tab (no Profile flash)", () => {
    ssr.search = "?tab=security"
    try {
      const html = renderToString(<AccountTabs {...panels} />)
      const container = document.createElement("div")
      container.innerHTML = html
      const security = within(container).getByRole("tab", {
        name: "Security",
      })
      expect(security).toHaveAttribute("aria-selected", "true")
    } finally {
      ssr.search = ""
    }
  })

  it("defaults to Profile and keeps the other panels mounted", () => {
    render(<AccountTabs {...panels} />)
    expect(selectedTab()).toBe("Profile")
    expect(screen.getByText("Devices body")).not.toBeVisible()
  })

  it("a click pushes ?tab=devices", async () => {
    const user = userEvent.setup()
    render(<AccountTabs {...panels} />)
    await user.click(screen.getByRole("tab", { name: "Devices" }))
    expect(window.location.search).toBe("?tab=devices")
    expect(pushes).toHaveBeenCalledTimes(1)
    expect(selectedTab()).toBe("Devices")
  })

  it("a keyboard choice replaces the history entry", async () => {
    const user = userEvent.setup()
    render(<AccountTabs {...panels} />)
    screen.getByRole("tab", { name: "Profile" }).focus()
    await user.keyboard("{ArrowRight}{Enter}")
    expect(selectedTab()).toBe("Security")
    expect(window.location.search).toBe("?tab=security")
    expect(pushes).not.toHaveBeenCalled()
    expect(replaces).toHaveBeenCalledTimes(1)
  })

  it("an old ?tab=sessions link opens Devices", () => {
    native.replace(null, "", "/admin/account?tab=sessions")
    render(<AccountTabs {...panels} />)
    expect(selectedTab()).toBe("Devices")
  })

  it("the user menu's Security switches the tab while on the account page", async () => {
    const user = userEvent.setup()
    native.replace(null, "", "/admin/account?tab=profile")
    render(
      <AdminShell
        queryClient={makeQueryClient()}
        session={{
          user: {
            id: "u1",
            name: "Edith Editor",
            email: "e@x.test",
            title: null,
            twoFactorEnabled: false,
          },
          roles: ["editor"],
          impersonatedBy: null,
        }}
      >
        <AccountTabs {...panels} />
      </AdminShell>
    )
    expect(selectedTab()).toBe("Profile")
    await user.click(
      screen.getByRole("button", { name: "Account menu for Edith Editor" })
    )
    await user.click(await screen.findByRole("menuitem", { name: "Security" }))
    await waitFor(() => expect(selectedTab()).toBe("Security"))
    expect(screen.getByText("Security body")).toBeVisible()
  })
})
