import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import {
  buildRail,
  currentHeading,
  highlightDash,
  RAIL_X,
} from "@/components/admin/help/help-toc"
import {
  HelpArticleView,
  HelpOverview,
  HelpShell,
} from "@/components/admin/help/help-view"
import { helpArticle, tocFor } from "@/lib/admin/help/registry"

const pathname = vi.hoisted(() => ({ current: "/admin/help" }))
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}))

const OLIVE = [{ name: "Olive Owner", email: "olive@example.ie" }]

describe("Help overview (MK B7, docs layout)", () => {
  it("keeps the shortcuts, the owners to mail and the runbook guides", () => {
    render(<HelpOverview roles={["owner"]} owners={OLIVE} />)
    expect(
      screen.getByRole("heading", { level: 1, name: "Help" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Keyboard shortcuts" })
    ).toBeInTheDocument()
    for (const action of [
      "Search and go",
      "AI assistant",
      "Save draft",
      "Close panels",
    ])
      expect(screen.getByText(action)).toBeInTheDocument()
    expect(screen.getByText("Esc")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Who to contact" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /olive@example\.ie/ })
    ).toHaveAttribute("href", "mailto:olive@example.ie")
    expect(screen.getByText("Olive Owner")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Guides" })).toBeInTheDocument()
    // The runbook is not served: its sections are titles, not links.
    expect(screen.getByText("Owner locked out")).not.toHaveAttribute("href")
  })

  it("gives the mailto a 44 px coarse target with a truncating email", () => {
    render(<HelpOverview roles={["owner"]} owners={OLIVE} />)
    const link = screen.getByRole("link", { name: /olive@example\.ie/ })
    expect(link).toHaveClass(
      "inline-flex",
      "items-center",
      "pointer-coarse:min-h-11"
    )
    expect(link.querySelector("span.truncate")).toHaveTextContent(
      "olive@example.ie"
    )
  })

  it("says so when there is no active owner", () => {
    render(<HelpOverview roles={["owner"]} owners={[]} />)
    expect(screen.getByText(/no active owner/i)).toBeInTheDocument()
  })

  it("lists a card per topic group, only with articles the role reads", () => {
    render(<HelpOverview roles={["intake"]} owners={OLIVE} />)
    for (const link of screen.getAllByRole("link", { name: /Getting started/ }))
      expect(link).toHaveAttribute("href", "/admin/help/getting-started")
    expect(
      screen.getByRole("heading", { name: "Enquiries & chat" })
    ).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Website" })).toBeNull()
    expect(screen.queryByRole("link", { name: "Media library" })).toBeNull()
  })
})

describe("help article page", () => {
  it("renders the topics sidebar, the article and its table of contents", () => {
    const article = helpArticle("media")!
    pathname.current = "/admin/help/media"
    render(
      <HelpShell roles={["owner"]}>
        <HelpArticleView article={article} roles={["owner"]} />
      </HelpShell>
    )
    // Desktop sidebar and the mobile drawer button.
    const topics = screen.getAllByRole("navigation", {
      name: "Help topics",
    })[0]!
    const current = within(topics).getByRole("link", { name: "Media library" })
    expect(current).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("button", { name: "Topics" })).toBeInTheDocument()

    expect(
      screen.getByRole("heading", { level: 1, name: "Media library" })
    ).toBeInTheDocument()
    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent)
    ).toEqual(
      article.sections
        .filter((section) => (section.level ?? 2) === 2)
        .map((section) => section.title)
    )
    expect(
      screen
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent)
    ).toEqual(
      article.sections
        .filter((section) => section.level === 3)
        .map((section) => section.title)
    )
    // Sub-sections are indented in the TOC, so its rail bends.
    const levels = within(
      screen.getByRole("navigation", { name: "On this page" })
    )
      .getAllByRole("link")
      .map((link) => link.getAttribute("data-level"))
    expect(levels).toEqual(tocFor(article).map((e) => String(e.level)))
    expect(levels).toContain("3")

    const toc = within(screen.getByRole("navigation", { name: "On this page" }))
      .getAllByRole("link")
      .map((link) => [link.textContent, link.getAttribute("href")])
    expect(toc).toEqual(tocFor(article).map((e) => [e.title, `#${e.id}`]))
    for (const [, href] of toc)
      expect(document.getElementById(href!.slice(1))).not.toBeNull()
    expect(screen.getByRole("navigation", { name: "breadcrumb" })).toBeDefined()
  })

  it("pages to the neighbours in sidebar order", () => {
    render(
      <HelpArticleView
        article={helpArticle("getting-started")!}
        roles={["owner"]}
      />
    )
    const pager = screen.getByRole("navigation", { name: "Pagination" })
    expect(within(pager).queryByText("Previous")).toBeNull()
    expect(within(pager).getByRole("link", { name: /Next/ })).toHaveAttribute(
      "href",
      "/admin/help/dashboard"
    )
  })

  it("renders a link to a screen the role cannot open as plain text", () => {
    render(
      <HelpArticleView
        article={helpArticle("getting-started")!}
        roles={["intake"]}
      />
    )
    expect(screen.getByRole("link", { name: "Enquiries" })).toHaveAttribute(
      "href",
      "/admin/leads"
    )
    expect(screen.queryByRole("link", { name: "Media" })).toBeNull()
    expect(screen.getAllByText(/Media/).length).toBeGreaterThan(0)
  })

  it("renders callouts as notes and key hints as kbd", () => {
    const { container } = render(
      <HelpArticleView
        article={helpArticle("search-and-shortcuts")!}
        roles={["owner"]}
      />
    )
    expect(screen.getAllByRole("note").length).toBeGreaterThan(0)
    expect(container.querySelector("kbd")).not.toBeNull()
  })
})

describe("the TOC rail", () => {
  it("steps in for h3 items and slides one dash along the path", () => {
    const rail = buildRail([
      { top: 0, height: 30, level: 2 },
      { top: 30, height: 30, level: 3 },
      { top: 60, height: 30, level: 2 },
    ])
    expect(rail.d.startsWith(`M${RAIL_X[2]} 0`)).toBe(true)
    expect(rail.d).toContain(`L${RAIL_X[3]}`)
    expect(rail.segments).toHaveLength(3)
    const dash = highlightDash(rail, 1)
    expect(dash.dashoffset).toBe(-rail.segments[1]!.start)
    expect(highlightDash(rail, -1).dasharray.startsWith("0 ")).toBe(true)
  })

  it("follows the last heading past the reading line", () => {
    const entries = [
      { id: "a", title: "A", level: 2 as const },
      { id: "b", title: "B", level: 2 as const },
      { id: "c", title: "C", level: 2 as const },
    ]
    const tops: Record<string, number> = { a: -400, b: 100, c: 600 }
    expect(currentHeading(entries, (id) => tops[id])).toBe("b")
    expect(currentHeading(entries, () => 900)).toBe("a")
    expect(currentHeading(entries, () => 900, true)).toBe("c")
  })
})
