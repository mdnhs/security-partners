import { render, screen, within } from "@testing-library/react"
import { Inbox } from "lucide-react"
import Link from "next/link"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ href, ...props }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props} />
  ),
}))

import { ActivityFeed } from "@/components/admin/kit/activity-feed"
import { ContentStatusPills } from "@/components/admin/kit/content-status"
import { DashboardCard } from "@/components/admin/kit/dashboard-card"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { KpiCard } from "@/components/admin/kit/kpi-card"
import { PillBarChart } from "@/components/admin/kit/pill-bar-chart"
import { CardSkeleton, KpiRowSkeleton } from "@/components/admin/kit/skeletons"
import { StatusPill } from "@/components/admin/kit/status-pill"
import {
  LINK_SECONDARY,
  PageHeader,
  PRIMARY_ACTION,
  SECONDARY_ACTION,
} from "@/components/admin/page-header"

describe("admin kit", () => {
  it("PageHeader: one h1, description, actions and breadcrumbs", () => {
    render(
      <PageHeader
        title="Pages"
        description="Every page of the site."
        breadcrumbs={<Link href="/admin">Back</Link>}
        actions={<button type="button">New</button>}
        titleTestId="title"
      />
    )
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Pages")
    expect(screen.getByTestId("title")).toHaveClass("text-title")
    expect(screen.getByText("Every page of the site.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back" })).toBeInTheDocument()
  })

  it("StatusPill carries its tone", () => {
    render(<StatusPill tone="warning">Unpublished changes</StatusPill>)
    const pill = screen.getByText("Unpublished changes")
    expect(pill).toHaveAttribute("data-tone", "warning")
    expect(pill).toHaveAttribute("data-slot", "status-pill")
    expect(pill).toHaveClass("bg-warning-soft", "text-warning")
  })

  it("DashboardCard is a region named by its heading", () => {
    render(
      <DashboardCard title="Next up">
        <p>Body</p>
      </DashboardCard>
    )
    const region = screen.getByRole("region", { name: "Next up" })
    expect(within(region).getByRole("heading", { level: 2 })).toHaveClass(
      "text-card-title"
    )
  })

  it("EmptyState says what will appear and offers the next step", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="No enquiries yet"
        description="New enquiries appear here."
        action={<button type="button">Open site</button>}
        role="status"
      />
    )
    const box = screen.getByRole("status")
    expect(box).toHaveTextContent("No enquiries yet")
    expect(box).toHaveTextContent("New enquiries appear here.")
    expect(
      within(box).getByRole("button", { name: "Open site" })
    ).toBeInTheDocument()
  })

  it("KpiCard: hero variant with a labelled link and a delta", () => {
    render(
      <KpiCard
        variant="hero"
        label="New enquiries"
        value="7"
        caption="vs the 30 days before"
        delta={{ label: "+40%", direction: "up" }}
        href="/admin/leads"
      />
    )
    const card = screen.getByRole("article")
    expect(card).toHaveAttribute("data-variant", "hero")
    expect(card).toHaveClass("bg-hero")
    expect(
      within(card).getByRole("link", { name: "Open New enquiries" })
    ).toHaveAttribute("href", "/admin/leads")
    expect(card).toHaveTextContent("+40% vs the 30 days before")
  })

  it("PillBarChart: hidden SVG, numbers in a table; one series without a comparison", () => {
    const { container } = render(
      <PillBarChart
        ariaLabel="Enquiries by week"
        rowHeader="Week"
        legend={{ current: "Enquiries", previous: "Previous" }}
        data={[
          { key: "a", label: "6 Oct", current: 2, previous: null },
          { key: "b", label: "13 Oct", current: 5, previous: null },
        ]}
      />
    )
    expect(
      screen.getByRole("figure", { name: "Enquiries by week" })
    ).toBeInTheDocument()
    const table = screen.getByRole("table", { name: "Enquiries by week" })
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((c) => c.textContent)
    ).toEqual(["Week", "Enquiries"])
    expect(
      within(table).getByRole("rowheader", { name: "13 Oct" })
    ).toBeInTheDocument()
    // No comparison data: no hatched legend swatch or bars.
    expect(screen.queryByText("Previous")).toBeNull()
    expect(container.querySelector("[data-series=previous]")).toBeNull()
  })

  it("PillBarChart inside a named card leaves the figure unnamed (table caption stays)", () => {
    const { container } = render(
      <PillBarChart
        ariaLabel="Enquiries by week"
        labelFigure={false}
        data={[{ key: "a", label: "6 Oct", current: 2, previous: null }]}
      />
    )
    const figure = container.querySelector("figure")
    expect(figure).not.toHaveAttribute("aria-label")
    expect(
      screen.getByRole("table", { name: "Enquiries by week" })
    ).toBeInTheDocument()
  })

  it("PillBarChart: two series with a hatched comparison legend", () => {
    render(
      <PillBarChart
        ariaLabel="Enquiries this week"
        legend={{ current: "This week", previous: "Last week" }}
        data={[{ key: "mon", label: "Mon", current: 1, previous: 3 }]}
      />
    )
    const table = screen.getByRole("table", { name: "Enquiries this week" })
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((c) => c.textContent)
    ).toEqual(["Day", "This week", "Last week"])
    // Not colour alone: the hatched swatch sits beside its text label.
    const swatch = document.querySelector("[data-series=previous]")
    expect(swatch).toHaveClass("bg-hatch")
    expect(swatch?.parentElement).toHaveTextContent("Last week")
  })

  it("every KpiCard links its chip", () => {
    render(<KpiCard label="Open enquiries" value="4" href="/admin/leads" />)
    const chip = screen.getByRole("link", { name: "Open Open enquiries" })
    expect(chip).toHaveAttribute("href", "/admin/leads")
    // 40 px chip, hit area grown past 44 px by the ::after overlay.
    expect(chip).toHaveClass(
      "size-10",
      "rounded-full",
      "border",
      "relative",
      "after:absolute",
      "after:-inset-1"
    )
    // -inset-1 already makes 48 px; a smaller coarse inset would shrink it.
    expect(chip.className).not.toContain("pointer-coarse:after:")
  })

  it("KpiCard without an href (bad data) renders chip-less instead of crashing", () => {
    render(
      <KpiCard label="Pages" value="12" href={undefined as unknown as string} />
    )
    expect(screen.getByRole("article")).toHaveTextContent("12")
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("PillBarChart draws current and hatched previous with a legend and an sr table", () => {
    render(
      <PillBarChart
        ariaLabel="Enquiries this week"
        legend={{ current: "This week", previous: "Last week" }}
        data={[{ key: "mon", label: "Mon", current: 2, previous: 1 }]}
      />
    )
    // The legend (the sr table's column header repeats the same text).
    expect(
      screen.getByText("This week", { selector: "figcaption span" })
    ).toBeInTheDocument()
    expect(screen.getByRole("table")).toHaveTextContent(/Mon.*2.*1/)
    expect(document.querySelectorAll("[data-series=previous]")).toHaveLength(1)
  })

  it("PillBarChart shows the empty overlay when all zero", () => {
    const { rerender } = render(
      <PillBarChart
        ariaLabel="x"
        emptyText="No enquiries yet"
        data={[{ key: "mon", label: "Mon", current: 0, previous: 0 }]}
      />
    )
    expect(screen.getByText("No enquiries yet")).toBeInTheDocument()
    rerender(
      <PillBarChart
        ariaLabel="x"
        emptyText="No enquiries yet"
        data={[{ key: "mon", label: "Mon", current: 0, previous: 2 }]}
      />
    )
    expect(screen.queryByText("No enquiries yet")).toBeNull()
  })

  it("PageHeader renders breadcrumbs with the current page", () => {
    render(
      <PageHeader
        title="Jane Doe"
        breadcrumbs={[
          { label: "Leads", href: "/admin/leads" },
          { label: "Jane Doe" },
        ]}
      />
    )
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" })
    expect(within(nav).getByRole("link", { name: "Leads" })).toHaveAttribute(
      "href",
      "/admin/leads"
    )
    expect(within(nav).getByText("Jane Doe")).toHaveAttribute(
      "aria-current",
      "page"
    )
    // Built on the shadcn breadcrumb primitives (A2).
    expect(nav).toHaveAttribute("data-slot", "breadcrumb")
    expect(nav.querySelector('[data-slot="breadcrumb-list"]')).not.toBeNull()
    expect(
      nav.querySelectorAll('[data-slot="breadcrumb-separator"]')
    ).toHaveLength(1)
    expect(within(nav).getByText("Jane Doe")).toHaveAttribute(
      "data-slot",
      "breadcrumb-page"
    )
  })

  it("PageHeader: only the last crumb is the current page", () => {
    render(
      <PageHeader
        title="Jane Doe"
        breadcrumbs={[
          { label: "Leads", href: "/admin/leads" },
          { label: "Archive" },
          { label: "Jane Doe" },
        ]}
      />
    )
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" })
    const middle = within(nav).getByText("Archive")
    expect(middle.tagName).toBe("SPAN")
    expect(middle).not.toHaveAttribute("aria-current")
    expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
    expect(within(nav).getByText("Jane Doe")).toHaveAttribute(
      "aria-current",
      "page"
    )
  })

  it("PageHeader keeps a custom ReactNode breadcrumb (back link) as-is", () => {
    render(
      <PageHeader
        title="Edit"
        breadcrumbs={<Link href="/admin/leads">Back to leads</Link>}
      />
    )
    expect(
      screen.getByRole("link", { name: "Back to leads" })
    ).toHaveAttribute("href", "/admin/leads")
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).toBeNull()
  })

  it("PageHeader action classes: SECONDARY is the outlined twin of PRIMARY", () => {
    expect(PRIMARY_ACTION).toBe(
      "h-12 gap-2 rounded-xl px-5 text-[15px] font-semibold"
    )
    for (const cls of PRIMARY_ACTION.split(" "))
      expect(SECONDARY_ACTION.split(" ")).toContain(cls)
    // Outline variant, primary border and text (MK).
    expect(LINK_SECONDARY.split(" ")).toEqual(
      expect.arrayContaining(["border-primary", "text-primary"])
    )
  })

  it("ActivityFeed lists entries with relative times, or an empty state", () => {
    const now = Date.parse("2026-10-16T12:00:00Z")
    const { rerender } = render(
      <ActivityFeed
        now={now}
        emptyTitle="No activity yet"
        emptyDescription="Your team's changes will show here."
        entries={[
          {
            id: "1",
            name: "Edith Editor",
            description: "published the home page",
            at: "2026-10-16T11:00:00Z",
            status: { label: "Published", tone: "success" },
          },
        ]}
      />
    )
    const region = screen.getByRole("region", { name: "Recent activity" })
    const item = within(region).getByRole("listitem")
    expect(item).toHaveTextContent("Edith Editor")
    expect(item).toHaveTextContent("published the home page · 1 hour ago")
    expect(within(item).getByText("Published")).toHaveAttribute(
      "data-tone",
      "success"
    )
    rerender(
      <ActivityFeed
        now={now}
        emptyTitle="No activity yet"
        emptyDescription="Your team's changes will show here."
        entries={[]}
      />
    )
    expect(screen.getByText("No activity yet")).toBeInTheDocument()
  })

  it("KpiCard heading is h3 by default and h2 on request", () => {
    const { rerender } = render(
      <KpiCard
        label="Pages"
        value="12"
        caption="published"
        href="/admin/pages"
      />
    )
    expect(
      screen.getByRole("heading", { level: 3, name: "Pages" })
    ).toBeInTheDocument()
    rerender(
      <KpiCard
        label="Pages"
        value="12"
        caption="published"
        href="/admin/pages"
        headingLevel={2}
      />
    )
    expect(
      screen.getByRole("heading", { level: 2, name: "Pages" })
    ).toBeInTheDocument()
  })

  it("PillBarChart hides the SVG container and formats table numbers", () => {
    const { container } = render(
      <PillBarChart
        ariaLabel="Views"
        legend={{ current: "This week", previous: "Last week" }}
        data={[{ key: "mon", label: "Mon", current: 12345, previous: 2000 }]}
      />
    )
    expect(container.querySelector('[data-slot="chart"]')).toHaveAttribute(
      "aria-hidden",
      "true"
    )
    const table = screen.getByRole("table", { name: "Views" })
    expect(
      within(table)
        .getAllByRole("cell")
        .map((c) => c.textContent)
    ).toEqual(["12,345", "2,000"])
  })

  it("ContentStatusPills shows Published plus Unpublished changes", () => {
    render(<ContentStatusPills record={{ published: {}, dirty: true }} />)
    expect(screen.getByText("Published")).toHaveAttribute(
      "data-tone",
      "success"
    )
    expect(screen.getByText("Unpublished changes")).toHaveAttribute(
      "data-tone",
      "warning"
    )
  })

  it("skeletons are hidden from assistive tech", () => {
    const { container } = render(
      <>
        <KpiRowSkeleton />
        <CardSkeleton />
      </>
    )
    const roots = [...container.children]
    expect(roots).toHaveLength(2)
    roots.forEach((node) => expect(node).toHaveAttribute("aria-hidden", "true"))
  })
})
