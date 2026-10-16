import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/services",
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import { makeQueryClient } from "@/components/admin/providers"
import { NewServiceForm } from "@/components/admin/services/new-service-form"
import { ServiceEditor } from "@/components/admin/services/service-editor"
import { ServicesScreen } from "@/components/admin/services/services-screen"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { Role } from "@/lib/auth/roles"
import type { ServiceDto } from "@/lib/schemas/api/services"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { servicesFixture } from "@/server/db/seed/fixtures/services"

const fixture = servicesFixture(fixtureMediaLookup)[0]
const ID = "00000000-0000-7000-8000-000000000001"
const dto: ServiceDto = {
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
const listItem = Object.fromEntries(
  Object.entries(dto).filter(([k]) => k !== "draft" && k !== "published")
)

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

let listItems: unknown[]
const fetchMock = vi.fn(
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    const method = init?.method ?? "GET"
    if (method === "GET" && url.pathname === "/api/v1/admin/services")
      return json(200, {
        items: listItems,
        page: 1,
        pageSize: 20,
        total: listItems.length,
      })
    if (method === "GET" && url.pathname === `/api/v1/admin/services/${ID}`)
      return json(200, dto)
    if (url.pathname.startsWith("/api/v1/admin/media/"))
      return json(404, { error: { code: "NOT_FOUND", message: "x" } })
    return json(200, { items: [], page: 1, pageSize: 20, total: 0 })
  }
)

beforeEach(() => {
  push.mockReset()
  fetchMock.mockClear()
  listItems = [listItem]
  vi.stubGlobal("fetch", fetchMock)
})

function renderWith(children: ReactNode, roles: Role[] = ["editor"]) {
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
        roles,
        impersonatedBy: null,
      }}
    >
      {children}
    </AdminShell>
  )
}

describe("services screens (master 4.6)", () => {
  it("lists services with status and links to the editor", async () => {
    renderWith(<ServicesScreen />)
    const table = await screen.findByRole("table", { name: "Services" })
    const link = within(table).getByRole("link", { name: dto.title })
    expect(link).toHaveAttribute("href", `/admin/services/${ID}`)
    expect(within(table).getByText(`/services/${dto.slug}`)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "New service" })).toHaveAttribute(
      "href",
      "/admin/services/new"
    )
  })

  it("empty list: New service action for editors, text only for viewers", async () => {
    listItems = []
    const { unmount } = renderWith(<ServicesScreen />)
    expect(await screen.findByText("No services yet.")).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "New service" })).toHaveLength(2)
    unmount()
    renderWith(<ServicesScreen />, ["viewer"])
    expect(await screen.findByText("No services yet.")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "New service" })).toBeNull()
  })

  it("new service: address follows the name and explains a disabled Create", async () => {
    const user = userEvent.setup()
    renderWith(<NewServiceForm />)
    const create = screen.getByRole("button", { name: "Create draft" })
    expect(create).toBeDisabled()
    expect(create).toHaveAccessibleDescription(/Enter the service name below/)
    await user.type(
      screen.getAllByRole("textbox", { name: "Name" })[0],
      "Event Security"
    )
    expect(screen.getByRole("textbox", { name: "/services/…" })).toHaveValue(
      "event-security"
    )
    expect(create).toBeEnabled()
    expect(
      screen.getByText("The page will be at /services/event-security.")
    ).toBeInTheDocument()
  })

  it("editor loads the service with its address card", async () => {
    renderWith(<ServiceEditor id={ID} />)
    expect(
      await screen.findByRole("heading", { name: "Page address" })
    ).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Address" })).toHaveValue(
      dto.slug
    )
    expect(
      screen.getByRole("button", { name: "Change address" })
    ).toBeDisabled()
    await waitFor(() =>
      expect(screen.getAllByRole("textbox", { name: "Name" })[0]).toHaveValue(
        dto.title
      )
    )
  })
})
