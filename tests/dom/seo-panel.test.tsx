import { QueryClientProvider } from "@tanstack/react-query"
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/pages/home",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

import { PageEditor } from "@/components/admin/pages/page-editor"
import { makeQueryClient } from "@/components/admin/providers"
import { draftFallbackTitle } from "@/components/admin/seo/editor-seo-tab"
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

  it("the live checklist follows the site robots mode (D1.6 M7)", () => {
    renderPanel({ siteNoindex: true })
    const checklist = screen.getByRole("list", { name: "SEO checklist" })
    expect(
      within(checklist)
        .getByText(
          "The whole site is hidden from search engines (SEO › Defaults)"
        )
        .closest("li")
    ).toHaveAttribute("data-ok", "false")
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

  it("Save SEO is enabled once something changed and sends the edited fields", async () => {
    const user = userEvent.setup()
    const { onSave } = renderPanel()
    expect(screen.getByRole("button", { name: "Save SEO" })).toBeDisabled()
    await user.type(
      screen.getByRole("textbox", { name: /^Social title/ }),
      "Alarm help"
    )
    await user.click(screen.getByRole("button", { name: "Save SEO" }))
    expect(onSave).toHaveBeenCalledWith({ ogTitle: "Alarm help" })
  })

  it("previews: the site default description and share image (review D1.4 M2/M3)", async () => {
    const IMAGE = "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b"
    routes[`GET /api/v1/admin/media/${IMAGE}`] = () =>
      json(200, {
        id: IMAGE,
        url: "/images/site-share.png",
        alt: "",
        width: 600,
        height: 315,
      })
    renderPanel({
      kind: "page",
      id: "about",
      path: "/about",
      fallback: { title: "About | Security Partners Ltd.", description: null },
      defaultDescription: "Security services across Ireland.",
      defaultImageId: IMAGE,
    })
    expect(
      screen.getByRole("figure", { name: "Search result preview" })
    ).toHaveTextContent("Security services across Ireland.")
    const checklist = screen.getByRole("list", { name: "SEO checklist" })
    expect(checklist).toHaveTextContent(
      "Uses the site-wide default description"
    )
    const card = screen.getByRole("figure", { name: "Social card preview" })
    await waitFor(() =>
      expect(card.querySelector("img")).toHaveAttribute(
        "src",
        "/images/site-share.png"
      )
    )
    // The default image is too small: the og-image check says so.
    expect(checklist).toHaveTextContent(
      "Share image should be at least 1200×630"
    )
  })

  it("a share image that fails to load leaves a labelled empty frame", async () => {
    renderPanel()
    const card = screen.getByRole("figure", { name: "Social card preview" })
    fireEvent.error(card.querySelector("img")!)
    expect(card.querySelector("img")).toBeNull()
    expect(card).toHaveTextContent("No preview")
  })

  it("X's small card choice shows the small layout", async () => {
    renderPanel({ value: { twitterCard: "summary" } })
    expect(
      screen.getByRole("figure", { name: "Social card preview" })
    ).toHaveAttribute("data-size", "small")
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
  function renderEditor(dto: PageDto = pageDto) {
    routes["GET /api/v1/admin/pages/home"] = () => json(200, dto)
    routes["GET /api/v1/admin/seo/overview"] = () =>
      json(200, {
        entries: [homeEntry],
        checks: { passed: 8, total: 8 },
        defaults: {
          titleTemplate: "{title} | Security Partners Ltd.",
          ogImageId: null,
        },
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

  it("a dirty editor switches to SEO without a leave prompt; reloads stay guarded (review D1.4 I1)", async () => {
    const user = userEvent.setup()
    routes["PUT /api/v1/admin/pages/home/draft"] = () =>
      new Promise<Response>(() => {})
    renderEditor()
    const hero = await screen.findByRole("region", { name: "Hero" })
    await user.type(within(hero).getByRole("textbox", { name: "Heading" }), "!")
    const bar = document.querySelector<HTMLElement>('[data-slot="editor-bar"]')!
    await user.click(within(bar).getByRole("link", { name: "SEO" }))
    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(screen.getByRole("tab", { name: "SEO" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    // The tabs themselves never ask either.
    await user.click(screen.getByRole("tab", { name: "Content" }))
    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(screen.getByRole("tab", { name: "Content" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    // No "confirmed leave" was recorded: a reload still prompts.
    const unload = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)
  })

  it("a failed publish on the SEO tab shows Content and focuses the first error (review D1.4 I2)", async () => {
    window.history.replaceState(null, "", "/admin/pages/home?tab=seo")
    const user = userEvent.setup()
    const invalid = { ...home, hero: { ...home.hero, heading: "" } }
    renderEditor({ ...pageDto, draft: invalid, dirty: true })
    await screen.findByRole("tab", { name: "SEO" })
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "SEO" })).toHaveAttribute(
        "aria-selected",
        "true"
      )
    )
    await user.click(screen.getByRole("button", { name: "Publish" }))
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Content" })).toHaveAttribute(
        "aria-selected",
        "true"
      )
    )
    expect(window.location.search).not.toContain("tab=seo")
    const hero = screen.getByRole("region", { name: "Hero" })
    await waitFor(() =>
      expect(
        within(hero).getByRole("textbox", { name: "Heading" })
      ).toHaveFocus()
    )
  })
})

describe("draftFallbackTitle (review D1.4 M7)", () => {
  const names = { live: "Security", draft: "Guarding" }
  it("applies the pattern to the draft name, even when the site name repeats it", () => {
    expect(
      draftFallbackTitle(
        "Security | Security Partners Ltd.",
        names,
        "{title} | Security Partners Ltd."
      )
    ).toBe("Guarding | Security Partners Ltd.")
  })
  it("keeps the live fallback when it is not the pattern (home's site title)", () => {
    expect(
      draftFallbackTitle(
        "Security Partners Ltd. | Watching Over You",
        names,
        "{title} | Security Partners Ltd."
      )
    ).toBe("Security Partners Ltd. | Watching Over You")
    expect(
      draftFallbackTitle("Security | X", names, "{title} | {phone24h}")
    ).toBe("Security | X")
  })
})
