import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const nav = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/seo",
  useRouter: () => ({ push: vi.fn(), replace: nav.replace, refresh: vi.fn() }),
  useSearchParams: () => nav.params,
}))

import { makeQueryClient } from "@/components/admin/providers"
import { SeoOverview } from "@/components/admin/seo/seo-overview"
import { AdminSessionProvider } from "@/components/admin/session-provider"
import type { Role } from "@/lib/auth/roles"
import type {
  SeoEntry,
  SeoHealthDto,
  SeoOverviewDto,
} from "@/lib/schemas/api/seo"
import { SEO_CHECKS } from "@/lib/seo/checks"

const entry = (over: Partial<SeoEntry>): SeoEntry => ({
  kind: "page",
  id: "home",
  name: "Home",
  path: "/",
  published: true,
  seo: {},
  title: "Security Partners Ltd. | Watching Over You",
  description: "Default description.",
  fallback: {
    title: "Security Partners Ltd. | Watching Over You",
    description: "Default description.",
  },
  image: "generated",
  issues: [],
  ...over,
})

const OVERVIEW: SeoOverviewDto = {
  entries: [
    entry({
      issues: [
        {
          check: "description",
          message: "Uses the site-wide default description",
        },
      ],
    }),
    entry({
      kind: "service",
      id: "00000000-0000-7000-8000-000000000001",
      name: "Alarm Responses",
      path: "/services/alarm-responses",
    }),
    entry({
      kind: "article",
      id: "00000000-0000-7000-8000-000000000002",
      name: "Draft post",
      path: "/blog/draft-post",
      published: false,
    }),
  ],
  checks: { passed: 7, total: 8 },
}

const MEDIA_ID = "00000000-0000-7000-8000-0000000000aa"
const passing = SEO_CHECKS.map((id) => ({ id, ok: true, message: "OK" }))
const HOME_ISSUE = "Uses the site-wide default description"

/** GET /seo/health: Home has one issue, a shared image lacks alt text. */
const HEALTH: SeoHealthDto = {
  score: 94,
  passed: 15,
  total: 16,
  entities: [
    {
      kind: "page",
      id: "home",
      title: "Home",
      path: "/",
      published: true,
      results: passing.map((r) =>
        r.id === "description" ? { ...r, ok: false, message: HOME_ISSUE } : r
      ),
    },
    {
      kind: "service",
      id: "00000000-0000-7000-8000-000000000001",
      title: "Alarm Responses",
      path: "/services/alarm-responses",
      published: true,
      results: passing,
    },
    {
      kind: "article",
      id: "00000000-0000-7000-8000-000000000002",
      title: "Draft post",
      path: "/blog/draft-post",
      published: false,
      results: passing,
    },
  ],
  issues: [
    {
      kind: "page",
      id: "home",
      title: "Home",
      path: "/",
      check: "description",
      message: HOME_ISSUE,
      fixHref: "/admin/pages/home?tab=seo",
    },
    {
      kind: "media",
      id: MEDIA_ID,
      title: "van.jpg",
      path: null,
      check: "alt-text",
      message: "1 image(s) missing alt text",
      fixHref: `/admin/media?missingAlt=true&open=${MEDIA_ID}`,
    },
  ],
  alt: { images: 12, described: 9, decorative: 2, missing: 1 },
}

const ALL_PASS: SeoHealthDto = {
  ...HEALTH,
  score: 100,
  passed: 16,
  issues: [],
  entities: HEALTH.entities.map((e) => ({ ...e, results: passing })),
}

let health: SeoHealthDto = HEALTH

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

const fetchMock = vi.fn(
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/v1/admin/seo/overview")
      return json(200, OVERVIEW)
    if (url.pathname === "/api/v1/admin/seo/health") return json(200, health)
    if (
      init?.method === "PUT" &&
      url.pathname === "/api/v1/admin/seo/entries/page/home"
    )
      return json(
        200,
        entry({ seo: (JSON.parse(String(init.body)) as { seo: object }).seo })
      )
    return json(404, { error: { code: "NOT_FOUND", message: "Not found" } })
  }
)

beforeEach(() => {
  nav.params = new URLSearchParams()
  health = HEALTH
  nav.replace.mockReset()
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
})

function renderAs(roles: Role[]) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <AdminSessionProvider
        value={{
          user: {
            id: "u",
            name: "U",
            email: "u@x.test",
            title: null,
            twoFactorEnabled: true,
          },
          roles,
          impersonatedBy: null,
        }}
      >
        <SeoOverview origin="https://www.example.ie" />
      </AdminSessionProvider>
    </QueryClientProvider>
  )
}

describe("SEO overview (master 8.1)", () => {
  it("shows the health gauge from /seo/health", async () => {
    renderAs(["editor"])
    expect(await screen.findByText("93%")).toBeInTheDocument()
    expect(
      screen.getByText("1 of 2 published pages need attention.")
    ).toBeInTheDocument()
  })

  it("the alt-text card counts images and links to the missing ones", async () => {
    renderAs(["editor"])
    const card = await screen.findByRole("region", { name: "Alt text" })
    expect(card).toHaveTextContent("9 of 12 images described · 2 decorative")
    expect(
      within(card).getByRole("link", { name: "Find images without alt text" })
    ).toHaveAttribute("href", "/admin/media?missingAlt=true")
  })

  it("Needs work (default) lists only entities with issues, each with a Fix link", async () => {
    renderAs(["editor"])
    const home = await screen.findByRole("region", { name: "Home" })
    expect(home).toHaveTextContent("/")
    expect(home).toHaveTextContent(HOME_ISSUE)
    expect(within(home).getByRole("link", { name: /^Fix/ })).toHaveAttribute(
      "href",
      "/admin/pages/home?tab=seo"
    )
    const image = screen.getByRole("region", { name: "van.jpg" })
    expect(within(image).getByRole("link", { name: /^Fix/ })).toHaveAttribute(
      "href",
      `/admin/media?missingAlt=true&open=${MEDIA_ID}`
    )
    // Passing and unpublished records are hidden.
    expect(screen.queryByRole("region", { name: "Alarm Responses" })).toBeNull()
    expect(screen.queryByRole("region", { name: "Draft post" })).toBeNull()
    expect(screen.queryByText("All checks pass")).toBeNull()
    // The filter: Needs work current, All adds ?show=all.
    const filter = screen.getByRole("navigation", { name: "Show" })
    expect(
      within(filter).getByRole("link", { name: "Needs work" })
    ).toHaveAttribute("aria-current", "page")
    expect(within(filter).getByRole("link", { name: "All" })).toHaveAttribute(
      "href",
      "/admin/seo?show=all"
    )
  })

  it("All (?show=all) also lists passing entities", async () => {
    nav.params = new URLSearchParams("show=all")
    renderAs(["editor"])
    const service = await screen.findByRole("region", {
      name: "Alarm Responses",
    })
    expect(service).toHaveTextContent("All checks pass")
    expect(within(service).queryByRole("link", { name: /^Fix/ })).toBeNull()
    expect(
      screen.getByRole("region", { name: "Draft post" })
    ).toHaveTextContent("Not published")
    expect(screen.getByRole("region", { name: "Home" })).toHaveTextContent(
      HOME_ISSUE
    )
    const filter = screen.getByRole("navigation", { name: "Show" })
    expect(within(filter).getByRole("link", { name: "All" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(
      within(filter).getByRole("link", { name: "Needs work" })
    ).toHaveAttribute("href", "/admin/seo")
  })

  it("no issues: Needs work says Nothing to fix", async () => {
    health = ALL_PASS
    renderAs(["editor"])
    expect(await screen.findByText("Nothing to fix")).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Home" })).toBeNull()
    expect(
      screen.getByText("Every published page passes the checks.")
    ).toBeInTheDocument()
  })

  it("Edit SEO puts the record in the address (?edit=)", async () => {
    const user = userEvent.setup()
    renderAs(["editor"])
    await user.click(
      await screen.findByRole("button", { name: "Edit SEO for Home" })
    )
    expect(nav.replace).toHaveBeenCalledWith("/admin/seo?edit=page%3Ahome", {
      scroll: false,
    })
  })

  it("the sheet previews the search result and saves the fields", async () => {
    nav.params = new URLSearchParams("edit=page:home")
    const user = userEvent.setup()
    renderAs(["editor"])
    const sheet = await screen.findByRole("dialog", { name: "SEO: Home" })
    // MK SERP: "host › segments" (home: the host alone).
    expect(
      within(sheet).getByRole("figure", { name: "Search result preview" })
    ).toHaveTextContent("www.example.ie")
    await user.type(
      within(sheet).getByRole("textbox", { name: /^Description/ }),
      "Security services across Ireland with a 24/7 operations team."
    )
    // The preview's snippet (the textarea holds the same text).
    expect(
      within(sheet).getByText(
        "Security services across Ireland with a 24/7 operations team.",
        { selector: "p" }
      )
    ).toBeInTheDocument()
    await user.click(within(sheet).getByRole("button", { name: "Save SEO" }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/admin/seo/entries/page/home"),
        expect.objectContaining({ method: "PUT" })
      )
    )
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT")!
    expect(JSON.parse(String(put[1]!.body))).toEqual({
      seo: {
        description:
          "Security services across Ireland with a 24/7 operations team.",
      },
    })
    await waitFor(() =>
      expect(nav.replace).toHaveBeenLastCalledWith("/admin/seo", {
        scroll: false,
      })
    )
  })

  it("closing with unsaved edits asks first; untouched closes at once", async () => {
    nav.params = new URLSearchParams("edit=page:home")
    const user = userEvent.setup()
    renderAs(["editor"])
    const sheet = await screen.findByRole("dialog", { name: "SEO: Home" })
    // Untouched: Esc closes straight away.
    await user.keyboard("{Escape}")
    expect(nav.replace).toHaveBeenLastCalledWith("/admin/seo", {
      scroll: false,
    })
    expect(screen.queryByRole("alertdialog")).toBeNull()
    nav.replace.mockClear()

    await user.type(
      within(sheet).getByRole("textbox", { name: /^Description/ }),
      "Draft words"
    )
    await user.keyboard("{Escape}")
    const confirm = await screen.findByRole("alertdialog", {
      name: "Discard your SEO changes?",
    })
    expect(nav.replace).not.toHaveBeenCalled()
    await user.click(
      within(confirm).getByRole("button", { name: "Keep editing" })
    )
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
    expect(
      within(sheet).getByRole("textbox", { name: /^Description/ })
    ).toHaveValue("Draft words")
    expect(nav.replace).not.toHaveBeenCalled()

    await user.keyboard("{Escape}")
    await user.click(
      within(
        await screen.findByRole("alertdialog", {
          name: "Discard your SEO changes?",
        })
      ).getByRole("button", { name: "Discard changes" })
    )
    expect(nav.replace).toHaveBeenLastCalledWith("/admin/seo", {
      scroll: false,
    })
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "PUT" })
    )
  })

  it("viewers can look but not save", async () => {
    nav.params = new URLSearchParams("edit=page:home")
    renderAs(["viewer"])
    await screen.findByRole("dialog", { name: "SEO: Home" })
    expect(screen.queryByRole("button", { name: "Save SEO" })).toBeNull()
    expect(
      screen.getByRole("button", { name: "View SEO for Home", hidden: true })
    ).toBeInTheDocument()
  })

  it("a failed load says so and offers Try again", async () => {
    fetchMock.mockImplementationOnce(async () =>
      json(403, { error: { code: "FORBIDDEN", message: "Not allowed" } })
    )
    renderAs(["editor"])
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("SEO health didn't load")
    expect(
      within(alert).getByRole("button", { name: "Try again" })
    ).toBeInTheDocument()
  })
})
