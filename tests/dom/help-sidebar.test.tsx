import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  activeHelpSlug,
  filterGroups,
  type HelpNavGroup,
  HelpSidebar,
  OPEN_GROUPS_KEY,
} from "@/components/admin/help/help-sidebar"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/help",
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}))

const GROUPS: HelpNavGroup[] = [
  {
    id: "start",
    label: "Getting started",
    articles: [
      { slug: "getting-started", title: "Getting started" },
      { slug: "roles", title: "Roles and permissions" },
    ],
  },
  {
    id: "content",
    label: "Content & media",
    articles: [{ slug: "media", title: "Media library" }],
  },
  {
    id: "inbox",
    label: "Enquiries & chat",
    articles: [{ slug: "enquiries", title: "Enquiries" }],
  },
]

const header = (name: string) => screen.getByRole("button", { name })
const expanded = (name: string) => header(name).getAttribute("aria-expanded")

beforeEach(() => window.localStorage.clear())

describe("HelpSidebar", () => {
  it("opens the current article's group and marks the article", () => {
    render(<HelpSidebar groups={GROUPS} active="media" />)
    expect(expanded("Content & media")).toBe("true")
    expect(expanded("Getting started")).toBe("false")
    const current = screen.getByRole("link", { name: "Media library" })
    expect(current).toHaveAttribute("aria-current", "page")
    expect(current).toHaveAttribute("href", "/admin/help/media")
    const panel = document.getElementById(
      header("Content & media").getAttribute("aria-controls")!
    )!
    expect(panel).toHaveAttribute("data-state", "open")
  })

  it("marks Overview on the overview", () => {
    render(<HelpSidebar groups={GROUPS} />)
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page"
    )
  })

  it("toggles several groups and remembers them in this browser", async () => {
    const user = userEvent.setup()
    render(<HelpSidebar groups={GROUPS} active={null} />)
    await user.click(header("Getting started"))
    await user.click(header("Enquiries & chat"))
    expect(expanded("Getting started")).toBe("true")
    expect(expanded("Enquiries & chat")).toBe("true")
    expect(JSON.parse(window.localStorage.getItem(OPEN_GROUPS_KEY)!)).toEqual([
      "start",
      "inbox",
    ])
    await user.click(header("Getting started"))
    expect(expanded("Getting started")).toBe("false")
  })

  it("filters topics by title and opens the matching groups", async () => {
    const user = userEvent.setup()
    render(<HelpSidebar groups={GROUPS} active={null} />)
    await user.type(screen.getByLabelText("Filter help topics"), "roles")
    expect(expanded("Getting started")).toBe("true")
    const panel = screen.getByTestId("help-group-start")
    expect(within(panel).getAllByRole("link")).toHaveLength(1)
    expect(screen.queryByRole("button", { name: "Content & media" })).toBeNull()
    await user.clear(screen.getByLabelText("Filter help topics"))
    await user.type(screen.getByLabelText("Filter help topics"), "zzz")
    expect(screen.getByText("No topics match.")).toBeInTheDocument()
  })

  it("closes the mobile drawer when a link is chosen", async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(
      <HelpSidebar groups={GROUPS} active="media" onNavigate={onNavigate} />
    )
    await user.click(screen.getByRole("link", { name: "Media library" }))
    expect(onNavigate).toHaveBeenCalled()
  })
})

describe("helpers", () => {
  it("reads the article slug from the path", () => {
    expect(activeHelpSlug("/admin/help")).toBeNull()
    expect(activeHelpSlug("/admin/help/media")).toBe("media")
    expect(activeHelpSlug("/admin/help/media#focal-point")).toBe("media")
  })

  it("keeps everything for an empty filter", () => {
    expect(filterGroups(GROUPS, "  ")).toEqual(GROUPS)
    expect(filterGroups(GROUPS, "ENQ").map((group) => group.id)).toEqual([
      "inbox",
    ])
  })
})
