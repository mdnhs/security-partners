import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { push, replace, search } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  search: { current: new URLSearchParams() },
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/careers/applications",
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  useSearchParams: () => search.current,
}))

import { ApplicationDetail } from "@/components/admin/careers/application-detail"
import { ApplicationsScreen } from "@/components/admin/careers/applications-screen"
import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { Role } from "@/lib/auth/roles"
import type {
  ApplicationDto,
  ApplicationListItem,
} from "@/lib/schemas/api/applications"

import { pickOption } from "../select-helper"

const JOB_ID = "11111111-1111-4111-8111-111111111111"
const ID = "22222222-2222-4222-8222-222222222222"

const item = (
  over: Partial<ApplicationListItem> = {}
): ApplicationListItem => ({
  id: ID,
  name: "Aoife Byrne",
  email: "aoife@example.ie",
  phone: "085 123 4567",
  status: "new",
  job: { id: JOB_ID, title: "Static Security Officer", slug: "static-officer" },
  createdAt: "2026-11-04T09:00:00.000Z",
  ...over,
})

let detail: ApplicationDto
const calls: { method: string; url: URL; body?: { status?: string } }[] = []
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

beforeEach(() => {
  push.mockReset()
  replace.mockReset()
  calls.length = 0
  search.current = new URLSearchParams()
  detail = {
    ...item(),
    answers: {
      firstName: "Aoife",
      surname: "Byrne",
      email: "aoife@example.ie",
      phone: "085 123 4567",
      address: "",
      town: "Portlaoise",
      eircode: "",
      rightToWork: "Irish or UK citizen",
      permissionExpiry: "",
      psa: "valid",
      psaNumber: "01234567",
      psaCategory: "Security Guard (Static)",
      psaExpiry: "2027-06-30",
      qualifications: ["Manual Handling"],
      history: [
        {
          employer: "Advance Security",
          role: "",
          from: "2021-03",
          to: "",
          reason: "",
        },
      ],
      gardaVetting: true,
      livedAbroad: false,
      experience: "3–5 years",
      startDate: "2026-12-01",
      shifts: ["Nights"],
      transport: true,
      coverNote: "",
      heardFrom: "",
      consents: [true, true, false],
    },
    cv: { name: "cv.pdf", mime: "application/pdf", size: 1200 },
    psaCard: { name: "card.png", mime: "image/png", size: 800 },
    note: "",
    updatedAt: "2026-11-04T09:00:00.000Z",
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost")
      const method = init?.method ?? "GET"
      const body = init?.body ? JSON.parse(String(init.body)) : undefined
      calls.push({ method, url, body })
      if (url.pathname === "/api/v1/admin/jobs")
        return json({
          items: [
            {
              id: JOB_ID,
              title: "Static Security Officer",
              slug: "static-officer",
            },
          ],
        })
      if (url.pathname === "/api/v1/admin/applications") {
        const status = url.searchParams.get("status")
        const items = [
          item(),
          item({
            id: "33333333-3333-4333-8333-333333333333",
            name: "Ciarán Doyle",
            status: "shortlisted",
          }),
        ].filter((i) => !status || i.status === status)
        return json({ items, page: 1, pageSize: 20, total: items.length })
      }
      if (url.pathname === `/api/v1/admin/applications/${ID}`) {
        if (method === "PATCH") detail = { ...detail, ...body }
        return json(detail)
      }
      return json({})
    })
  )
})

function renderWith(children: React.ReactNode, roles: Role[] = ["owner"]) {
  return render(
    <AdminShell
      queryClient={makeQueryClient()}
      session={{
        user: {
          id: "u1",
          name: "Olive Owner",
          email: "o@example.test",
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

const listCalls = () =>
  calls.filter((c) => c.url.pathname === "/api/v1/admin/applications")

describe("applications inbox", () => {
  it("lists applications with status pills", async () => {
    renderWith(<ApplicationsScreen />)
    const table = await screen.findByRole("table", { name: "Applications" })
    expect(within(table).getByText("Aoife Byrne")).toBeInTheDocument()
    expect(within(table).getByText("Shortlisted")).toBeInTheDocument()
    expect(
      within(table).getAllByText("Static Security Officer").length
    ).toBeGreaterThan(0)
  })

  it("filters by status and job from the query string", async () => {
    search.current = new URLSearchParams(`status=shortlisted&job=${JOB_ID}`)
    renderWith(<ApplicationsScreen />)
    const table = await screen.findByRole("table", { name: "Applications" })
    expect(within(table).queryByText("Aoife Byrne")).toBeNull()
    const last = listCalls().at(-1)!.url.searchParams
    expect(last.get("status")).toBe("shortlisted")
    expect(last.get("job")).toBe(JOB_ID)
  })
})

describe("application detail", () => {
  it("shows every answer group and both downloads", async () => {
    renderWith(<ApplicationDetail id={ID} />)
    for (const title of [
      "Personal Details",
      "Right to Work in Ireland",
      "PSA Licence",
      "5-Year History & Screening",
      "Experience & Availability",
      "CV & Cover Note",
      "Declaration & Consent",
    ])
      expect(
        await screen.findByRole("heading", { name: title })
      ).toBeInTheDocument()
    expect(screen.getByText("01234567")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /cv\.pdf/ })).toHaveAttribute(
      "href",
      `/api/v1/admin/applications/${ID}/files/cv`
    )
    expect(screen.getByRole("link", { name: /card\.png/ })).toHaveAttribute(
      "href",
      `/api/v1/admin/applications/${ID}/files/psa-card`
    )
  })

  it("changing the status sends PATCH and updates the pill", async () => {
    const user = userEvent.setup()
    renderWith(<ApplicationDetail id={ID} />)
    await screen.findByRole("heading", { name: "Personal Details" })
    await pickOption(
      user,
      screen.getByRole("combobox", { name: "Status" }),
      "Shortlisted"
    )
    await waitFor(() =>
      expect(
        calls.some(
          (c) => c.method === "PATCH" && c.body?.status === "shortlisted"
        )
      ).toBe(true)
    )
    expect(await screen.findByTestId("application-status")).toHaveTextContent(
      "Shortlisted"
    )
  })
})
