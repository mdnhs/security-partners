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

const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const dto: DashboardDto = {
  kpis: {
    leads30d: { value: 7, previous: 5 },
    openLeads: 3,
    published: { pages: 8, services: 6, articles: 8 },
    inReview: 2,
    seoScore: 92,
    subscribers: null,
  },
  enquiriesWeek: {
    days: WEEK_LABELS.map((label, i) => ({
      key: `2026-10-${String(12 + i).padStart(2, "0")}`,
      label,
      current: i === 3 ? 4 : 0,
      previous: i === 1 ? 3 : 0,
    })),
    current: 4,
    previous: 3,
    previousToDate: 3,
  },
  contentHealth: { complete: 14, needsWork: 5, missing: 3 },
  qa: [
    {
      rule: "placeholder-contact",
      label: "Contact details",
      href: "/admin/settings/contact",
      message: 'Placeholder contact details: "[phone]".',
    },
    {
      rule: "legal-unpublished",
      label: "Terms of use",
      href: "/admin/pages/terms",
      message: "Not published yet: the site links to it from every footer.",
    },
  ],
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
      "default",
    ])
    expect(cards[0]).toHaveTextContent("New enquiries")
    expect(cards[0]).toHaveTextContent("7")
    // 7 vs 5 in the 30 days before.
    expect(cards[0]).toHaveTextContent("+40.0% vs the previous 30 days")
    expect(cards[3]).toHaveTextContent("SEO health")
    expect(cards[3]).toHaveTextContent("92%")
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

  it("hero delta: New (never ∞% or NaN) when the 30 days before had none", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input), "http://localhost").pathname
        if (path.endsWith("/dashboard"))
          return Response.json({
            ...dto,
            kpis: { ...dto.kpis, leads30d: { value: 3, previous: 0 } },
          } satisfies DashboardDto)
        return Response.json(audit)
      })
    )
    renderDashboard(["owner"])
    const [hero] = await screen.findAllByRole("article")
    expect(hero).toHaveTextContent("New · none in the previous 30 days")
    expect(hero).not.toHaveTextContent(/∞|NaN|Infinity/)
  })

  it("Monday morning: this week so far is compared with last week up to the same time, not all of it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input), "http://localhost").pathname
        if (path.endsWith("/dashboard"))
          return Response.json({
            ...dto,
            enquiriesWeek: {
              days: dto.enquiriesWeek!.days.map((d) => ({
                ...d,
                current: 0,
                previous: 2,
              })),
              current: 0,
              previous: 14,
              previousToDate: 0,
            },
          } satisfies DashboardDto)
        return Response.json(audit)
      })
    )
    renderDashboard(["owner"])
    const card = await screen.findByRole("region", {
      name: "Enquiries this week",
    })
    expect(card).toHaveTextContent(
      "0 so far, 0 by this time last week · 14 in all of last week"
    )
    expect(card).not.toHaveTextContent(/-100|%/)
  })

  it("Enquiries this week: Mon–Sun pills beside last week, with a data table", async () => {
    renderDashboard(["owner"])
    const card = await screen.findByRole("region", {
      name: "Enquiries this week",
    })
    expect(card).toHaveTextContent(
      "4 so far, 3 by this time last week (+33.3%) · 3 in all of last week"
    )
    const table = within(card).getByRole("table", {
      name: "Enquiries this week",
    })
    // Header + 7 days.
    expect(within(table).getAllByRole("row")).toHaveLength(8)
    expect(
      within(table)
        .getAllByRole("rowheader")
        .map((cell) => cell.textContent)
    ).toEqual(WEEK_LABELS)
    expect(
      within(table).getByRole("columnheader", { name: "This week" })
    ).toBeInTheDocument()
    expect(
      within(table).getByRole("columnheader", { name: "Last week" })
    ).toBeInTheDocument()
    const thursday = within(table).getByRole("rowheader", {
      name: "Thu",
    }).parentElement!
    expect(thursday).toHaveTextContent("Thu40")
  })

  it("Content health: a 3-part gauge from the dashboard data (no extra request)", async () => {
    renderDashboard(["owner"])
    const card = await screen.findByRole("region", { name: "Content health" })
    // 14 of 22 published records pass every check.
    expect(card).toHaveTextContent("63%")
    for (const label of [
      "Complete",
      "Needs work",
      "Missing description or alt text",
    ])
      expect(card).toHaveTextContent(label)
    expect(
      within(card).getByRole("link", { name: "Open SEO" })
    ).toHaveAttribute("href", "/admin/seo")
    const calls = vi.mocked(fetch).mock.calls.map(([input]) => String(input))
    expect(calls.some((url) => url.includes("/seo/health"))).toBe(false)
  })

  it("Content QA lists each finding as a link to its editor", async () => {
    renderDashboard(["owner"])
    const card = await screen.findByRole("region", { name: "Content QA" })
    expect(card).toHaveTextContent("2 to fix")
    const list = within(card).getByRole("list", { name: "Content QA findings" })
    const links = within(list).getAllByRole("link")
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/admin/settings/contact",
      "/admin/pages/terms",
    ])
    expect(links[0]).toHaveTextContent("Contact details")
    expect(links[0]).toHaveTextContent('"[phone]"')
    expect(links[1]).toHaveTextContent("Legal page")
    // 44 px rows: every pointer, not only coarse.
    for (const link of links) expect(link).toHaveClass("min-h-11")
  })

  it("Content QA is not drawn when there is nothing to fix", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input), "http://localhost").pathname
        if (path.endsWith("/dashboard"))
          return Response.json({ ...dto, qa: [] } satisfies DashboardDto)
        return Response.json(audit)
      })
    )
    renderDashboard(["owner"])
    await screen.findByRole("region", { name: "Content health" })
    expect(screen.queryByRole("region", { name: "Content QA" })).toBeNull()
  })

  it("Next up: Reply to the oldest new enquiry opens its drawer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input), "http://localhost").pathname
        if (path.endsWith("/dashboard"))
          return Response.json({
            ...dto,
            nextUp: [
              {
                id: "reply",
                title: "Reply to Ada <b>Lovelace</b>",
                description: "The oldest enquiry still marked New.",
                href: "/admin/leads?lead=0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
                done: false,
              },
            ],
          } satisfies DashboardDto)
        return Response.json(audit)
      })
    )
    renderDashboard(["intake"])
    const next = await screen.findByRole("region", { name: "Next up" })
    // Plain text, never markup.
    expect(next).toHaveTextContent("Reply to Ada <b>Lovelace</b>")
    expect(next.querySelector("b")).toBeNull()
    expect(
      within(next).getByRole("link", { name: "Open enquiry" })
    ).toHaveAttribute(
      "href",
      "/admin/leads?lead=0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b"
    )
  })

  it("Next up: headline, checklist with states and the call to action", async () => {
    renderDashboard(["owner"])
    const next = await screen.findByRole("region", { name: "Next up" })
    expect(next).toHaveTextContent("Set up email (SMTP)")
    expect(next).toHaveTextContent("So enquiries and invites reach people.")
    const list = within(next).getByRole("list", { name: "Next steps" })
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

  it("A9: Next up rows sit at MK's 28 px pitch, 44 px on touch", async () => {
    renderDashboard(["owner"])
    const next = await screen.findByRole("region", { name: "Next up" })
    const list = within(next).getByRole("list", { name: "Next steps" })
    // 24 px rows (the WCAG 2.2 AA minimum) 4 px apart; 44 px on coarse pointers.
    expect(list).toHaveClass("gap-1")
    for (const link of within(list).getAllByRole("link")) {
      expect(link).toHaveClass("min-h-6", "pointer-coarse:min-h-11")
      expect(link).not.toHaveClass("min-h-11")
    }
  })

  it("A9: the KPI row follows the header by the page gap only (MK)", async () => {
    renderDashboard(["owner"])
    await screen.findAllByRole("article")
    // The page's flex gap-6 spaces header and KPIs; no extra header margin.
    const header = screen.getByTestId("greeting").closest("header")
    expect(header).not.toHaveClass("mb-6")
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
    const list = within(next).getByRole("list", { name: "Next steps" })
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
    expect(await screen.findAllByRole("article")).toHaveLength(5)
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
            enquiriesWeek: {
              days: dto.enquiriesWeek!.days.map((d) => ({
                ...d,
                current: 0,
                previous: 0,
              })),
              current: 0,
              previous: 0,
              previousToDate: 0,
            },
          } satisfies DashboardDto)
        return Response.json(audit)
      })
    )
    renderDashboard(["owner"])
    const card = await screen.findByRole("region", {
      name: "Enquiries this week",
    })
    expect(card).toHaveTextContent(
      "0 so far, 0 by this time last week · 0 in all of last week"
    )
    expect(card).not.toHaveTextContent(/∞|NaN/)
    // The overlay is real text inside the labelled figure, not decoration.
    const overlay = within(card).getByText("No enquiries this week or last")
    expect(overlay.closest("[aria-hidden]")).toBeNull()
    // Named once, by the card; the figure adds no second name and the sr
    // table keeps its caption.
    const figure = overlay.closest("figure")
    expect(figure).not.toBeNull()
    expect(figure).not.toHaveAttribute("aria-label")
    expect(
      within(card).getByRole("table", { name: "Enquiries this week" })
    ).toBeInTheDocument()
  })

  it("shows Newsletter subscribers when the API sends them (D4.3)", async () => {
    const withSubscribers: DashboardDto = {
      ...dto,
      kpis: { ...dto.kpis, subscribers: { confirmed: 1234, since30d: 5 } },
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input), "http://localhost").pathname
        if (path.endsWith("/seo/health")) return Response.json(SEO_HEALTH)
        if (path.endsWith("/dashboard")) return Response.json(withSubscribers)
        if (path.endsWith("/audit")) return Response.json(audit)
        return Response.json(
          { error: { code: "NOT_FOUND", message: "x" } },
          { status: 404 }
        )
      })
    )
    renderDashboard(["owner"])
    const cards = await screen.findAllByRole("article")
    const card = cards.at(-1)!
    expect(card).toHaveTextContent("Newsletter subscribers")
    expect(card).toHaveTextContent("5 new in the last 30 days")
    expect(within(card).getByRole("link")).toHaveAttribute(
      "href",
      "/admin/newsletter"
    )
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
      "/admin/seo",
      "/admin/insights?status=in_review",
    ])
    // MK: the four brief KPIs share one row on wide screens; the fifth wraps.
    expect(cards[0]!.parentElement).toHaveClass("xl:grid-cols-4")
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
                seoScore: null,
                subscribers: null,
              },
              enquiriesWeek: null,
              contentHealth: null,
              qa: null,
              nextUp: [],
            } satisfies DashboardDto)
      )
    )
    renderDashboard(["viewer"])
    const cards = await screen.findAllByRole("article")
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveTextContent("Drafts in review")
    for (const name of ["Enquiries this week", "Content health", "Content QA"])
      expect(screen.queryByRole("region", { name })).not.toBeInTheDocument()
    const next = screen.getByRole("region", { name: "Next up" })
    expect(next).toHaveTextContent("You're all set")
  })
})
