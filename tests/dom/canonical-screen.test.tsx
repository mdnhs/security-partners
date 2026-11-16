import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { makeQueryClient } from "@/components/admin/providers"
import {
  CanonicalScreen,
  canonicalOf,
} from "@/components/admin/seo/canonical-screen"
import { AdminSessionProvider } from "@/components/admin/session-provider"
import type { Role } from "@/lib/auth/roles"
import type { SeoEntry, SeoOverviewDto } from "@/lib/schemas/api/seo"

const ORIGIN = "https://www.example.ie"

const entry = (over: Partial<SeoEntry>): SeoEntry => ({
  kind: "page",
  id: "about",
  name: "About",
  path: "/about",
  published: true,
  seo: {},
  title: "About",
  description: "D",
  fallback: { title: "About", description: "D" },
  image: "generated",
  issues: [],
  ...over,
})

const OVERVIEW: SeoOverviewDto = {
  entries: [
    entry({ seo: { title: "Own title" } }),
    entry({
      kind: "service",
      id: "00000000-0000-7000-8000-000000000001",
      name: "Medical Cleaning",
      path: "/services/medical-cleaning",
      seo: { canonical: "https://partner.ie/medical" },
    }),
  ],
  checks: { passed: 8, total: 8 },
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

const puts: { path: string; seo: Record<string, unknown> }[] = []
const fetchMock = vi.fn(
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/v1/admin/seo/overview")
      return json(200, OVERVIEW)
    if (init?.method === "PUT") {
      const { seo } = JSON.parse(String(init.body)) as {
        seo: Record<string, unknown>
      }
      puts.push({ path: url.pathname, seo })
      return json(200, { ...OVERVIEW.entries[0], seo })
    }
    return json(404, { error: { code: "NOT_FOUND", message: "Not found" } })
  }
)

beforeEach(() => {
  puts.length = 0
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
        <CanonicalScreen origin={ORIGIN} />
      </AdminSessionProvider>
    </QueryClientProvider>
  )
}

describe("canonicalOf", () => {
  it("is the page itself unless an override is set", () => {
    expect(canonicalOf(entry({}), ORIGIN)).toBe(`${ORIGIN}/about`)
    expect(canonicalOf(entry({ path: "/" }), ORIGIN)).toBe(`${ORIGIN}/`)
    expect(
      canonicalOf(entry({ seo: { canonical: "https://x.ie/a" } }), ORIGIN)
    ).toBe("https://x.ie/a")
  })
})

describe("CanonicalScreen", () => {
  it("lists each page with Self or Custom and its canonical address", async () => {
    renderAs(["owner"])
    const list = await screen.findByRole("list", {
      name: "Pages and their canonical URLs",
    })
    const rows = within(list).getAllByRole("listitem")
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent("Self")
    expect(rows[0]).toHaveTextContent(`${ORIGIN}/about`)
    expect(rows[1]).toHaveTextContent("Custom")
    expect(rows[1]).toHaveTextContent("https://partner.ie/medical")
    await userEvent.click(screen.getByRole("button", { name: "Custom (1)" }))
    expect(within(list).getAllByRole("listitem")).toHaveLength(1)
  })

  it("saves a canonical and keeps the record's other SEO fields", async () => {
    renderAs(["owner"])
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit canonical URL of About" })
    )
    await userEvent.type(
      screen.getByLabelText("Canonical address"),
      "https://partner.ie/about"
    )
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0]).toEqual({
      path: "/api/v1/admin/seo/entries/page/about",
      seo: { title: "Own title", canonical: "https://partner.ie/about" },
    })
  })

  it("'Use the page itself' drops the override", async () => {
    renderAs(["owner"])
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Edit canonical URL of Medical Cleaning",
      })
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Use the page itself" })
    )
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0]!.seo).toEqual({})
  })

  it("no Edit buttons without seo:update", async () => {
    renderAs(["viewer"])
    await screen.findByRole("list", { name: "Pages and their canonical URLs" })
    expect(screen.queryByRole("button", { name: /^Edit canonical/ })).toBeNull()
  })
})
