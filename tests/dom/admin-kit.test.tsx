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
import { DashboardCard } from "@/components/admin/kit/dashboard-card"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { KpiCard } from "@/components/admin/kit/kpi-card"
import { PillBarChart } from "@/components/admin/kit/pill-bar-chart"
import { StatusPill } from "@/components/admin/kit/status-pill"
import { PageHeader } from "@/components/admin/page-header"

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
    render(
      <PillBarChart
        title="Enquiries by week"
        rowHeader="Week"
        currentLabel="Enquiries"
        data={[
          { key: "a", label: "6 Oct", current: 2 },
          { key: "b", label: "13 Oct", current: 5 },
        ]}
      />
    )
    const table = screen.getByRole("table", { name: "Enquiries by week" })
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((c) => c.textContent)
    ).toEqual(["Week", "Enquiries"])
    expect(
      within(table).getByRole("rowheader", { name: "13 Oct" })
    ).toBeInTheDocument()
    expect(
      screen.getByText("Enquiries", { selector: "figcaption span" })
    ).toBeInTheDocument()
  })

  it("PillBarChart: two series with a hatched comparison legend", () => {
    render(
      <PillBarChart
        title="Enquiries this week"
        currentLabel="This week"
        previousLabel="Last week"
        data={[{ key: "mon", label: "Mon", current: 1, previous: 3 }]}
      />
    )
    const table = screen.getByRole("table", { name: "Enquiries this week" })
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((c) => c.textContent)
    ).toEqual(["Day", "This week", "Last week"])
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
})
