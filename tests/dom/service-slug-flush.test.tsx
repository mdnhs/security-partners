import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/services/x",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import { makeQueryClient } from "@/components/admin/providers"
import { ServiceEditor } from "@/components/admin/services/service-editor"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { ServiceDto } from "@/lib/schemas/api/services"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { servicesFixture } from "@/server/db/seed/fixtures/services"

const fixture = servicesFixture(fixtureMediaLookup)[0]
const ID = "00000000-0000-7000-8000-000000000001"
const initial: ServiceDto = {
  id: ID,
  slug: fixture.slug,
  sortOrder: 0,
  title: fixture.content.title,
  draft: fixture.content,
  published: fixture.content,
  version: 3,
  status: "published",
  dirty: false,
  publishedAt: "2026-10-16T09:00:00.000Z",
  updatedAt: "2026-10-16T09:00:00.000Z",
  updatedBy: null,
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

let current: ServiceDto
let writes: { method: string; path: string; body: Record<string, unknown> }[]
let failDraft = false
let holdSlug: Promise<void> | null = null

beforeEach(() => {
  current = structuredClone(initial)
  writes = []
  failDraft = false
  holdSlug = null
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost")
      const method = init?.method ?? "GET"
      const base = `/api/v1/admin/services/${ID}`
      if (method === "GET" && url.pathname === base) return json(200, current)
      if (method !== "GET") {
        const body = JSON.parse(String(init?.body ?? "{}"))
        writes.push({ method, path: url.pathname.slice(base.length), body })
        if (url.pathname === `${base}/draft`) {
          if (failDraft)
            return json(500, { error: { code: "INTERNAL", message: "Down" } })
          current = {
            ...current,
            draft: body.draft,
            title: body.draft.title,
            version: current.version + 1,
            dirty: true,
          }
          return json(200, current)
        }
        if (url.pathname === `${base}/slug`) {
          if (holdSlug) await holdSlug
          if (body.version !== current.version)
            return json(409, {
              error: {
                code: "CONFLICT",
                message: "Changed",
                current,
                requestId: "r",
              },
            })
          current = {
            ...current,
            slug: body.slug,
            version: current.version + 1,
          }
          return json(200, current)
        }
      }
      if (url.pathname.startsWith("/api/v1/admin/media/"))
        return json(404, { error: { code: "NOT_FOUND", message: "x" } })
      return json(200, { items: [], page: 1, pageSize: 20, total: 0 })
    })
  )
})

function renderEditor() {
  return render(
    <AdminShell
      queryClient={makeQueryClient()}
      session={{
        user: {
          id: "u",
          name: "U",
          email: "u@x.test",
          title: null,
          twoFactorEnabled: true,
        },
        roles: ["editor"],
        impersonatedBy: null,
      }}
    >
      <ServiceEditor id={ID} />
    </AdminShell>
  )
}

describe("service address change keeps pending edits (ledger P04-10)", () => {
  it("saves the pending edit first and moves with the version that save returned", async () => {
    const user = userEvent.setup()
    renderEditor()
    const name = () => screen.getAllByRole("textbox", { name: "Name" })[0]
    await waitFor(() => expect(name()).toHaveValue(initial.title))
    await user.clear(name())
    await user.type(name(), "Mobile Patrols Plus")
    const address = screen.getByRole("textbox", { name: "Address" })
    await user.clear(address)
    await user.type(address, "mobile-patrols-plus")
    await user.click(screen.getByRole("button", { name: "Change address" }))
    await waitFor(() =>
      expect(writes.map((w) => `${w.method} ${w.path}`)).toEqual([
        "PUT /draft",
        "PATCH /slug",
      ])
    )
    expect(writes[1].body).toMatchObject({
      slug: "mobile-patrols-plus",
      version: 4,
    })
    await waitFor(() => expect(name()).toHaveValue("Mobile Patrols Plus"))
  })

  it("an invalid draft blocks the move and says which fields to fix", async () => {
    const user = userEvent.setup()
    renderEditor()
    const name = () => screen.getAllByRole("textbox", { name: "Name" })[0]
    await waitFor(() => expect(name()).toHaveValue(initial.title))
    await user.clear(name())
    const address = screen.getByRole("textbox", { name: "Address" })
    await user.clear(address)
    await user.type(address, "moved")
    await user.click(screen.getByRole("button", { name: "Change address" }))
    expect(
      await screen.findByText(
        "Save your changes first: fix the fields marked in red, then change the address."
      )
    ).toBeInTheDocument()
    expect(name()).toHaveAttribute("aria-invalid", "true")
    expect(writes).toEqual([])
  })

  it("a failed save blocks the move without blaming the fields", async () => {
    const user = userEvent.setup()
    failDraft = true
    renderEditor()
    const name = () => screen.getAllByRole("textbox", { name: "Name" })[0]
    await waitFor(() => expect(name()).toHaveValue(initial.title))
    await user.type(name(), "!")
    const address = screen.getByRole("textbox", { name: "Address" })
    await user.clear(address)
    await user.type(address, "moved")
    await user.click(screen.getByRole("button", { name: "Change address" }))
    expect(
      await screen.findByText(
        "Save your changes first, then change the address."
      )
    ).toBeInTheDocument()
    expect(writes.map((w) => `${w.method} ${w.path}`)).not.toContain(
      "PATCH /slug"
    )
  })

  it("locks the address field while the move runs", async () => {
    const user = userEvent.setup()
    let release: () => void = () => undefined
    holdSlug = new Promise<void>((resolve) => (release = resolve))
    renderEditor()
    const name = () => screen.getAllByRole("textbox", { name: "Name" })[0]
    await waitFor(() => expect(name()).toHaveValue(initial.title))
    const address = screen.getByRole("textbox", { name: "Address" })
    await user.clear(address)
    await user.type(address, "moved")
    await user.click(screen.getByRole("button", { name: "Change address" }))
    await waitFor(() => expect(address).toBeDisabled())
    release()
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Address" })).toBeEnabled()
    )
  })
})
