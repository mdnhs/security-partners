import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ href, ...props }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props} />
  ),
}))

import { Dashboard } from "@/components/admin/dashboard/dashboard"
import { makeQueryClient } from "@/components/admin/providers"
import { AdminSessionProvider } from "@/components/admin/session-provider"
import { SiteInfoProvider } from "@/components/admin/shell/site-context"
import type { Role } from "@/lib/auth/roles"
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
      description: "So enquiries and invites reach people.",
      href: "/admin/settings/integrations/smtp",
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

/** The Content health card (roles with seo:read) reads GET /seo/health (D1.2). */
const SEO_HEALTH = {
  score: 100,
  passed: 0,
  total: 0,
  entities: [],
  issues: [],
  alt: { images: 0, described: 0, decorative: 0, missing: 0 },
}

const audit = {
  items: [
    {
      id: "a1",
      action: "page.published",
      entityType: "page",
      entityId: "home",
      actor: { id: "u1", name: "Edith Editor", email: "e@example.test" },
      impersonatorId: null,
      ip: null,
      userAgent: null,
      diff: null,
      createdAt: "2026-10-16T10:00:00Z",
    },
  ],
  page: 1,
  pageSize: 6,
  total: 1,
}

function renderDashboard(roles: Role[]) {
  return render(
    <AdminSessionProvider
      value={{
        user: {
          id: "u1",
          name: "Edith Editor",
          email: "e@example.test",
          title: null,
          twoFactorEnabled: true,
        },
        roles,
        impersonatedBy: null,
      }}
    >
      <SiteInfoProvider
        value={{ url: "https://example.test", env: "production" }}
      >
        <QueryClientProvider client={makeQueryClient()}>
          <Dashboard firstName="Edith" renderedAt="2026-10-16T08:30:00Z" />
        </QueryClientProvider>
      </SiteInfoProvider>
    </AdminSessionProvider>
  )
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input), "http://localhost").pathname
      if (path.endsWith("/seo/health")) return Response.json(SEO_HEALTH)
      if (path.endsWith("/dashboard")) return Response.json(dto)
      if (path.endsWith("/audit")) return Response.json(audit)
      return Response.json(
        { error: { code: "NOT_FOUND", message: "x" } },
        { status: 404 }
      )
    })
  )
})

describe("dashboard (JW layout)", () => {
  it("greets, offers the button pair and shows the KPI row with the hero first", async () => {
    renderDashboard(["owner"])
    expect(screen.getByTestId("greeting")).toHaveTextContent(
      "Good morning, Edith"
    )
    expect(screen.getByRole("link", { name: "New service" })).toHaveAttribute(
      "href",
      "/admin/services/new"
    )
    expect(
      screen.getByRole("link", { name: "View site (opens in a new tab)" })
    ).toHaveAttribute("href", "https://example.test")
    const cards = await screen.findAllByRole("article")
    expect(cards.map((c) => c.getAttribute("data-variant"))).toEqual([
      "hero",
      "default",
      "default",
      "default",
    ])
    expect(cards[0]).toHaveTextContent("New enquiries")
    expect(cards[0]).toHaveTextContent("7")
    expect(cards[2]).toHaveTextContent("22")
    expect(cards[2]).toHaveTextContent("8 pages · 6 services · 8 articles")
    expect(
      within(cards[2]).getByRole("link", { name: "Open Published content" })
    ).toHaveAttribute("href", "/admin/pages")
  })

  it("announces loading with the skeletons hidden from assistive tech", () => {
    renderDashboard(["owner"])
    expect(screen.getByRole("status")).toHaveTextContent("Loading dashboard")
    expect(screen.queryByRole("article")).not.toBeInTheDocument()
  })

  it("draws the 90-day trend as weekly pills with a data table", async () => {
    renderDashboard(["owner"])
    const card = await screen.findByRole("region", {
      name: "Enquiries, last 90 days",
    })
    const table = within(card).getByRole("table", {
      name: "Enquiries, last 90 days",
    })
    expect(within(table).getAllByRole("row")).toHaveLength(14)
    expect(
      within(table).getByRole("rowheader", { name: "10 Oct" })
    ).toBeInTheDocument()
  })

  it("Next up: headline, checklist with states and the call to action", async () => {
    renderDashboard(["owner"])
    const next = await screen.findByRole("region", { name: "Next up" })
    expect(next).toHaveTextContent("Set up email (SMTP)")
    expect(next).toHaveTextContent("So enquiries and invites reach people.")
    const list = within(next).getByRole("list", { name: "Setup checklist" })
    expect(
      within(list).getByRole("link", {
        name: /Set up email \(SMTP\).*\(to do\)/,
      })
    ).toHaveAttribute("href", "/admin/settings/integrations/smtp")
    expect(
      within(list).getByRole("link", { name: /two-factor.*\(done\)/ })
    ).toBeInTheDocument()
    expect(
      within(next).getByRole("link", { name: "Get started" })
    ).toHaveAttribute("href", "/admin/settings/integrations/smtp")
  })

  it("Next up leads with the spam-protection warning when Turnstile settings can't be read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input), "http://localhost").pathname
        if (path.endsWith("/seo/health")) return Response.json(SEO_HEALTH)
        if (path.endsWith("/dashboard"))
          return Response.json({
            ...dto,
            nextUp: [
              {
                id: "turnstile-unreadable",
                title: "Spam protection is off",
                description:
                  "Turnstile settings can't be read — re-enter the keys in Integrations.",
                href: "/admin/settings/integrations/turnstile",
                done: false,
              },
              ...dto.nextUp,
            ],
          } satisfies DashboardDto)
        return Response.json(audit)
      })
    )
    renderDashboard(["owner"])
    const next = await screen.findByRole("region", { name: "Next up" })
    expect(next).toHaveTextContent(
      "Spam protection is off" +
        "Turnstile settings can't be read — re-enter the keys in Integrations."
    )
    const list = within(next).getByRole("list", { name: "Setup checklist" })
    expect(
      within(list).getByRole("link", {
        name: /Spam protection is off.*\(to do\)/,
      })
    ).toHaveAttribute("href", "/admin/settings/integrations/turnstile")
    expect(
      within(next).getByRole("link", { name: "Get started" })
    ).toHaveAttribute("href", "/admin/settings/integrations/turnstile")
  })

  it("no spam-protection warning in the default (seeded) dashboard", async () => {
    renderDashboard(["owner"])
    const next = await screen.findByRole("region", { name: "Next up" })
    expect(next).not.toHaveTextContent("Spam protection is off")
  })

  it("team activity for audit readers only", async () => {
    renderDashboard(["owner"])
    const feed = await screen.findByRole("region", { name: "Team activity" })
    expect(await within(feed).findByText("Edith Editor")).toBeInTheDocument()
    expect(feed).toHaveTextContent("published the home page")
  })

  it("hides what the role may not see", async () => {
    renderDashboard(["viewer"])
    await screen.findAllByRole("article")
    expect(screen.queryByRole("link", { name: "New service" })).toBeNull()
    expect(screen.queryByRole("region", { name: "Team activity" })).toBeNull()
  })

  it("a failed dashboard load is an alert whose Try again refetches", async () => {
    let fail = true
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input), "http://localhost").pathname
        if (path.endsWith("/seo/health")) return Response.json(SEO_HEALTH)
        if (path.endsWith("/dashboard") && fail)
          return Response.json(
            { error: { code: "FORBIDDEN", message: "Not allowed" } },
            { status: 403 }
          )
        if (path.endsWith("/dashboard")) return Response.json(dto)
        return Response.json(audit)
      })
    )
    renderDashboard(["owner"])
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("The dashboard didn't load")
    expect(alert).toHaveTextContent("Not allowed")
    fail = false
    await userEvent.click(
      within(alert).getByRole("button", { name: "Try again" })
    )
    expect(await screen.findAllByRole("article")).toHaveLength(4)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("team activity: loading is announced, a failed load is an alert with Try again", async () => {
    let fail = true
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input), "http://localhost").pathname
        if (path.endsWith("/seo/health")) return Response.json(SEO_HEALTH)
        if (path.endsWith("/dashboard")) return Response.json(dto)
        if (fail)
          return Response.json(
            { error: { code: "FORBIDDEN", message: "Not allowed" } },
            { status: 403 }
          )
        return Response.json(audit)
      })
    )
    renderDashboard(["owner"])
    const feed = await screen.findByRole("region", { name: "Team activity" })
    const alert = await within(feed).findByRole("alert")
    expect(alert).toHaveTextContent("Team activity didn't load")
    fail = false
    await userEvent.click(
      within(alert).getByRole("button", { name: "Try again" })
    )
    expect(await within(feed).findByText("Edith Editor")).toBeInTheDocument()
    expect(within(feed).queryByRole("alert")).not.toBeInTheDocument()
  })

  it("the quiet chart says so in text inside the labelled figure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input), "http://localhost").pathname
        if (path.endsWith("/seo/health")) return Response.json(SEO_HEALTH)
        if (path.endsWith("/dashboard"))
          return Response.json({
            ...dto,
            leadsTrend: dto.leadsTrend!.map((d) => ({ ...d, count: 0 })),
          } satisfies DashboardDto)
        return Response.json(audit)
      })
    )
    renderDashboard(["owner"])
    const card = await screen.findByRole("region", {
      name: "Enquiries, last 90 days",
    })
    // The overlay is real text inside the labelled figure, not decoration.
    const overlay = within(card).getByText("No enquiries yet")
    expect(overlay.closest("[aria-hidden]")).toBeNull()
    // Named once, by the card; the figure adds no second name and the sr
    // table keeps its caption.
    const figure = overlay.closest("figure")
    expect(figure).not.toBeNull()
    expect(figure).not.toHaveAttribute("aria-label")
    expect(
      within(card).getByRole("table", { name: "Enquiries, last 90 days" })
    ).toBeInTheDocument()
  })

  it("every KPI links its chip to the screen it counts", async () => {
    renderDashboard(["owner"])
    const cards = await screen.findAllByRole("article")
    expect(
      cards.map(
        (card) => within(card).getByRole("link").getAttribute("href") ?? ""
      )
    ).toEqual([
      "/admin/leads",
      "/admin/leads",
      "/admin/pages",
      "/admin/insights?status=in_review",
    ])
  })

  it("omits parts the API returned as null and keeps Next up when empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        new URL(String(input), "http://localhost").pathname.endsWith(
          "/seo/health"
        )
          ? Response.json(SEO_HEALTH)
          : Response.json({
              kpis: {
                leads30d: null,
                openLeads: null,
                published: null,
                inReview: 0,
              },
              leadsTrend: null,
              nextUp: [],
            } satisfies DashboardDto)
      )
    )
    renderDashboard(["viewer"])
    const cards = await screen.findAllByRole("article")
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveTextContent("Drafts in review")
    expect(
      screen.queryByRole("region", { name: "Enquiries, last 90 days" })
    ).not.toBeInTheDocument()
    const next = screen.getByRole("region", { name: "Next up" })
    expect(next).toHaveTextContent("You're all set")
  })
})
