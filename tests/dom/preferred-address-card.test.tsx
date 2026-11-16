import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { makeQueryClient } from "@/components/admin/providers"
import {
  PreferredAddressCard,
  preferredOptions,
} from "@/components/admin/seo/preferred-address-card"
import { AdminSessionProvider } from "@/components/admin/session-provider"
import type { Role } from "@/lib/auth/roles"
import type { PreferredAddressDto } from "@/lib/schemas/api/seo"

let current: PreferredAddressDto
const puts: unknown[] = []

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

const fetchMock = vi.fn(
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname !== "/api/v1/admin/seo/preferred-address")
      return json(404, { error: { code: "NOT_FOUND", message: "Not found" } })
    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body)) as PreferredAddressDto
      puts.push(body)
      current = { ...current, preferredHost: body.preferredHost }
    }
    return json(200, current)
  }
)

beforeEach(() => {
  current = { preferredHost: "off", siteHost: "cleaningpartners.ie" }
  puts.length = 0
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
        <PreferredAddressCard />
      </AdminSessionProvider>
    </QueryClientProvider>
  )
}

describe("preferredOptions", () => {
  it("names the site's real addresses", () => {
    expect(preferredOptions("cleaningpartners.ie").map((o) => o.label)).toEqual(
      [
        "Off: keep all four addresses working",
        "Without www: https://cleaningpartners.ie",
        "With www: https://www.cleaningpartners.ie",
      ]
    )
  })
})

describe("PreferredAddressCard", () => {
  it("saves the chosen main address; Save waits for a change", async () => {
    renderAs(["owner"])
    const select = await screen.findByRole("combobox", { name: "Main address" })
    await waitFor(() => expect(select).toBeEnabled())
    const save = screen.getByRole("button", { name: "Save" })
    expect(save).toBeDisabled()
    await userEvent.click(select)
    await userEvent.click(
      await screen.findByRole("option", {
        name: "Without www: https://cleaningpartners.ie",
      })
    )
    expect(save).toBeEnabled()
    await userEvent.click(save)
    await waitFor(() => expect(puts).toEqual([{ preferredHost: "apex" }]))
    await waitFor(() => expect(save).toBeDisabled())
  })

  it("without a production URL it points to Settings › Site and stays off", async () => {
    current = { preferredHost: "off", siteHost: null }
    renderAs(["owner"])
    expect(
      await screen.findByRole("link", { name: "Settings › Site" })
    ).toHaveAttribute("href", "/admin/settings/site")
    expect(
      screen.getByRole("combobox", { name: "Main address" })
    ).toBeDisabled()
  })

  it("a viewer sees the choice but no Save", async () => {
    renderAs(["viewer"])
    await screen.findByRole("combobox", { name: "Main address" })
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull()
  })
})
