import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/pages/home",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

import { PageEditor } from "@/components/admin/pages/page-editor"
import { makeQueryClient } from "@/components/admin/providers"
import { SeoPanel, type SeoPanelProps } from "@/components/admin/seo/seo-panel"
import { AdminSessionProvider } from "@/components/admin/session-provider"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { PageDto } from "@/lib/schemas/api/content"
import type { SeoEntry, SeoOverviewDto } from "@/lib/schemas/api/seo"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { pagesFixture } from "@/server/db/seed/fixtures/pages"

const SERVICE_ID = "00000000-0000-7000-8000-000000000001"

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

let routes: Record<string, (init?: RequestInit) => Response | Promise<Response>>
const fetchMock = vi.fn(
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    const route = routes[`${init?.method ?? "GET"} ${url.pathname}`]
    if (route) return route(init)
    if (url.pathname.startsWith("/api/v1/admin/media/"))
      return json(404, { error: { code: "NOT_FOUND", message: "x" } })
    return json(200, { items: [], page: 1, pageSize: 24, total: 0 })
  }
)

beforeEach(() => {
  window.history.replaceState(null, "", "/admin/services/x")
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
  routes = {}
})

const session = {
  user: {
    id: "u1",
    name: "Edith",
    email: "e@x.test",
    title: null,
    twoFactorEnabled: true,
  },
  roles: ["editor" as const],
  impersonatedBy: null,
}

function renderPanel(over: Partial<SeoPanelProps> = {}) {
  const onSave = vi.fn(async () => {})
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <AdminSessionProvider value={session}>
        <SeoPanel
          kind="service"
          id={SERVICE_ID}
          path="/services/alarm-responses"
          origin="https://example.ie"
          fallback={{
            title: "Alarm Responses | Security Partners Ltd.",
            description:
              "Keyholders and patrol officers respond to your alarm activations around the clock.",
          }}
          value={{}}
          onSave={onSave}
          canEdit
          {...over}
        />
      </AdminSessionProvider>
    </QueryClientProvider>
  )
  return { onSave }
}

describe("SeoPanel (MK D1.4)", () => {
  it("a 20-character title fails title-length in the live checklist, without saving", async () => {
    const user = userEvent.setup()
    const { onSave } = renderPanel()
    const checklist = screen.getByRole("list", { name: "SEO checklist" })
    // The fallback title (40 characters) passes first.
    expect(
      within(checklist)
        .getByText(/^Title is 40 characters/)
        .closest("li")
    ).toHaveAttribute("data-ok", "true")
    await user.type(
      screen.getByRole("textbox", { name: /^Title/ }),
      "Alarm response today"
    )
    const item = within(checklist)
      .getByText("Title is 20 characters (aim for 30–60)")
      .closest("li")!
    expect(item).toHaveAttribute("data-ok", "false")
    // Not colour only: the state is in the text too.
    expect(item).toHaveTextContent(/Needs work/)
    expect(onSave).not.toHaveBeenCalled()
    // Only the checks an editor can see change locally.
    expect(within(checklist).getAllByRole("listitem")).toHaveLength(4)
  })

  it("the search result shows host › segments, the title and description", () => {
    renderPanel()
    const serp = screen.getByRole("figure", { name: "Search result preview" })
    expect(serp).toHaveTextContent("example.ie › services › alarm-responses")
    expect(serp).toHaveTextContent("Alarm Responses | Security Partners Ltd.")
  })

  it("without a share image the social card shows the generated card", async () => {
    const user = userEvent.setup()
    renderPanel()
    const card = screen.getByRole("figure", { name: "Social card preview" })
    expect(card.querySelector("img")).toHaveAttribute(
      "src",
      "/og/service/alarm-responses"
    )
    // The social title overrides the card's title only.
    await user.type(
      screen.getByRole("textbox", { name: /^Social title/ }),
      "Alarm help 24/7"
    )
    expect(card).toHaveTextContent("Alarm help 24/7")
    expect(
      screen.getByRole("figure", { name: "Search result preview" })
    ).not.toHaveTextContent("Alarm help 24/7")
  })

  it("Save SEO sends the edited fields; viewers get no Save button", async () => {
    const user = userEvent.setup()
    const { onSave } = renderPanel()
    await user.type(
      screen.getByRole("textbox", { name: /^Social title/ }),
      "Alarm help"
    )
    await user.click(screen.getByRole("button", { name: "Save SEO" }))
    expect(onSave).toHaveBeenCalledWith({ ogTitle: "Alarm help" })
  })

  it("read-only without seo:update", () => {
    renderPanel({ canEdit: false })
    expect(screen.queryByRole("button", { name: "Save SEO" })).toBeNull()
    expect(screen.getByRole("textbox", { name: /^Title/ })).toBeDisabled()
  })
})

const home = pagesFixture(fixtureMediaLookup).home.data
const pageDto: PageDto = {
  key: "home",
  label: "Home",
  template: "home",
  path: "/",
  draft: home,
  published: home,
  version: 1,
  status: "published",
  dirty: false,
  publishedAt: "2026-10-16T09:00:00.000Z",
  updatedAt: "2026-10-16T10:00:00.000Z",
  updatedBy: { id: "u2", name: "Other Editor" },
}
const homeEntry: SeoEntry = {
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
}

describe("editor SEO tab (MK D1.4)", () => {
  function renderEditor() {
    routes["GET /api/v1/admin/pages/home"] = () => json(200, pageDto)
    routes["GET /api/v1/admin/seo/overview"] = () =>
      json(200, {
        entries: [homeEntry],
        checks: { passed: 8, total: 8 },
      } satisfies SeoOverviewDto)
    return render(
      <AdminShell queryClient={makeQueryClient()} session={session}>
        <PageEditor pageKey="home" origin="https://example.ie" />
      </AdminShell>
    )
  }

  it("?tab=seo opens the SEO tab; unsaved SEO edits survive a switch to Content and back", async () => {
    window.history.replaceState(null, "", "/admin/pages/home?tab=seo")
    const user = userEvent.setup()
    const put = vi.fn((init?: RequestInit) =>
      json(200, {
        ...homeEntry,
        seo: (JSON.parse(String(init?.body)) as { seo: object }).seo,
      })
    )
    routes["PUT /api/v1/admin/seo/entries/page/home"] = put
    renderEditor()
    const seoTab = await screen.findByRole("tab", { name: "SEO" })
    expect(seoTab).toHaveAttribute("aria-selected", "true")
    const socialTitle = await screen.findByRole("textbox", {
      name: /^Social title/,
    })
    await user.type(socialTitle, "Security you can call on")

    await user.click(screen.getByRole("tab", { name: "Content" }))
    expect(window.location.search).not.toContain("tab=seo")
    expect(
      await screen.findByRole("region", { name: "Hero" })
    ).toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: "SEO" }))
    expect(window.location.search).toContain("tab=seo")
    expect(screen.getByRole("textbox", { name: /^Social title/ })).toHaveValue(
      "Security you can call on"
    )
    expect(put).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Save SEO" }))
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    expect(JSON.parse(String(put.mock.calls[0][0]?.body))).toEqual({
      seo: { ogTitle: "Security you can call on" },
    })
  })

  it("the header SEO link selects the SEO tab on the same page", async () => {
    const user = userEvent.setup()
    renderEditor()
    await screen.findByRole("region", { name: "Hero" })
    const bar = document.querySelector<HTMLElement>('[data-slot="editor-bar"]')!
    const link = within(bar).getByRole("link", { name: "SEO" })
    expect(link).toHaveAttribute("href", "?tab=seo")
    await user.click(link)
    expect(screen.getByRole("tab", { name: "SEO" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    expect(window.location.pathname).toBe("/admin/services/x")
    expect(window.location.search).toBe("?tab=seo")
  })
})
