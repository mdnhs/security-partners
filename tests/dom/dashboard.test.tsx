import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ href, ...props }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props} />
  ),
}))

import { Dashboard } from "@/components/admin/dashboard/dashboard"
import { makeQueryClient } from "@/components/admin/providers"
import type { DashboardDto } from "@/lib/schemas/api/dashboard"

const dto: DashboardDto = {
  kpis: {
    leads30d: 7,
    openLeads: 3,
    published: { pages: 8, services: 6, articles: 8 },
    inReview: 2,
  },
  leadsTrend: Array.from({ length: 90 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 6, 19 + i)).toISOString().slice(0, 10),
    count: i === 89 ? 4 : i === 80 ? 3 : 0,
  })),
  nextUp: [
    {
      id: "smtp",
      title: "Set up email (SMTP)",
      description: "d",
      href: "/admin/settings",
      done: false,
    },
    {
      id: "two-factor",
      title: "Turn on two-factor authentication",
      description: "d",
      href: "/admin/account",
      done: true,
    },
  ],
}

function renderDashboard() {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <Dashboard />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(dto), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    )
  )
})

describe("dashboard (master 4.7)", () => {
  it("announces loading with the skeletons hidden from assistive tech", () => {
    renderDashboard()
    expect(screen.getByRole("status")).toHaveTextContent("Loading dashboard")
    expect(screen.queryByRole("heading")).not.toBeInTheDocument()
  })

  it("shows KPIs, the trend summary and the Next up checklist", async () => {
    renderDashboard()
    expect(
      await screen.findByRole("heading", { level: 2, name: "Enquiries (30 days)" })
    ).toBeInTheDocument()
    expect(screen.getByText("7")).toBeInTheDocument()
    expect(screen.getByText("22")).toBeInTheDocument()
    expect(
      screen.getByText("8 pages · 6 services · 8 articles")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("img", {
        name: /^7 enquiries in the last 90 days\. Busiest day: 16 Oct with 4\.$/,
      })
    ).toBeInTheDocument()
    const next = screen.getByRole("region", { name: "Next up" })
    expect(next).toHaveTextContent("1 to do")
    expect(
      within(next).getByRole("link", {
        name: /Set up email \(SMTP\).*\(to do\)/,
      })
    ).toHaveAttribute("href", "/admin/settings")
    expect(
      within(next).getByRole("link", { name: /two-factor.*\(done\)/ })
    ).toBeInTheDocument()
  })

  it("omits parts the API returned as null and the checklist when empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          kpis: { leads30d: null, openLeads: null, published: null, inReview: 0 },
          leadsTrend: null,
          nextUp: [],
        } satisfies DashboardDto)
      )
    )
    renderDashboard()
    expect(
      await screen.findByRole("heading", { level: 2, name: "Drafts in review" })
    ).toBeInTheDocument()
    expect(screen.queryByText("Enquiries (30 days)")).not.toBeInTheDocument()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("region", { name: "Next up" })
    ).not.toBeInTheDocument()
  })
})
