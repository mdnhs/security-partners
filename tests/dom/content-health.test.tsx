import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ContentHealthCard } from "@/components/admin/dashboard/content-health"
import { makeQueryClient } from "@/components/admin/providers"
import { AdminSessionProvider } from "@/components/admin/session-provider"
import type { Role } from "@/lib/auth/roles"

const fetchMock = vi.fn(
  async () =>
    new Response(
      JSON.stringify({ entries: [], checks: { passed: 30, total: 40 } }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
)

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
})

const renderAs = (roles: Role[]) =>
  render(
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
        <ContentHealthCard />
      </AdminSessionProvider>
    </QueryClientProvider>
  )

describe("dashboard Content health card", () => {
  it("shows the share of passing SEO checks with a link to SEO", async () => {
    renderAs(["marketer"])
    expect(await screen.findByText("75%")).toBeInTheDocument()
    expect(
      screen.getByRole("region", { name: "Content health" })
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open SEO" })).toHaveAttribute(
      "href",
      "/admin/seo"
    )
  })

  it("is absent (and fetches nothing) without seo:read", () => {
    renderAs(["author"])
    expect(screen.queryByRole("region", { name: "Content health" })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
