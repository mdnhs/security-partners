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
import type { SeoEntry, SeoOverviewDto } from "@/lib/schemas/api/seo"

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
  it("shows the health gauge and every record grouped, with its issues", async () => {
    renderAs(["editor"])
    expect(await screen.findByText("87%")).toBeInTheDocument()
    expect(
      screen.getByText("1 of 2 published pages need attention.")
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole("region", { name: "Pages" })).getByText(
        "Uses the site-wide default description"
      )
    ).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Services" })).toHaveTextContent(
      "All checks pass"
    )
    expect(screen.getByRole("region", { name: "Articles" })).toHaveTextContent(
      "Not published"
    )
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
    expect(
      within(sheet).getByText("https://www.example.ie/")
    ).toBeInTheDocument()
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
