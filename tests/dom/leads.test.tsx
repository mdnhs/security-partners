import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const push = vi.fn()
const replace = vi.fn()
const refresh = vi.fn()
let search = ""
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/leads",
  useRouter: () => ({ push, replace, refresh }),
  useSearchParams: () => new URLSearchParams(search),
}))

import { LeadDetail } from "@/components/admin/leads/lead-detail"
import { LeadsScreen } from "@/components/admin/leads/leads-screen"
import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { Role } from "@/lib/auth/roles"
import type { LeadDto } from "@/lib/schemas/api/leads"

const ID = "0190a6e0-0000-7000-8000-0000000000aa"
const GONE = "0190a6e0-0000-7000-8000-0000000000bb"
const lead: LeadDto = {
  id: ID,
  name: "Dinn Rí",
  email: "dinn@example.ie",
  phone: "085 000 0000",
  company: null,
  service: null,
  status: "new",
  assignee: null,
  sourcePage: "/contact",
  createdAt: "2026-10-16T09:00:00.000Z",
  updatedAt: "2026-10-16T09:00:00.000Z",
  message: "Line one\nLine two",
  consent: true,
  events: [
    {
      id: "e1",
      type: "created",
      body: "Sent from /contact",
      actor: null,
      createdAt: "2026-10-16T09:00:00.000Z",
    },
    {
      id: "e2",
      type: "note",
      body: "Rang back",
      actor: { id: "u", name: "Ian Intake" },
      createdAt: "2026-10-16T10:00:00.000Z",
    },
  ],
}

/** Test knobs: hold PATCH replies until released; fail them; export reply. */
let holdPatch: Promise<void> | null = null
let failPatch = false
let exportStatus = 200

const calls: { url: string; method: string; body: unknown }[] = []
beforeEach(() => {
  calls.length = 0
  search = ""
  holdPatch = null
  failPatch = false
  exportStatus = 200
  push.mockClear()
  replace.mockClear()
  refresh.mockClear()
  window.history.replaceState(null, "", "/admin/leads")
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      const method =
        init?.method ?? (input instanceof Request ? input.method : "GET")
      const body = init?.body ? JSON.parse(String(init.body)) : undefined
      calls.push({ url, method, body })
      const reply = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), {
          status,
          headers: { "content-type": "application/json" },
        })
      if (url.includes("/leads/export.csv"))
        return exportStatus === 200
          ? new Response("﻿Name\r\nDinn Rí\r\n", {
              headers: {
                "content-type": "text/csv; charset=utf-8",
                "content-disposition":
                  'attachment; filename="leads-2026-10-16.csv"',
              },
            })
          : reply(
              {
                error: {
                  code: "VALIDATION",
                  message:
                    "More than 50,000 enquiries match. Narrow the filters to export.",
                },
              },
              exportStatus
            )
      if (url.includes("/leads/assignees"))
        return reply({
          items: [{ id: "u", name: "Ian Intake", email: "ian@x.test" }],
        })
      if (url.includes(`/leads/${ID}/events`))
        return reply(
          {
            ...lead,
            events: [
              ...lead.events,
              {
                id: "e3",
                type: "note",
                body: body.body,
                actor: { id: "u", name: "Ian Intake" },
                createdAt: "2026-10-16T11:00:00.000Z",
              },
            ],
          },
          201
        )
      if (url.includes(`/leads/${ID}`)) {
        if (method === "PATCH") {
          if (holdPatch) await holdPatch
          if (failPatch)
            return reply(
              { error: { code: "CONFLICT", message: "Someone else saved" } },
              409
            )
          return reply({ ...lead, ...body })
        }
        if (method === "DELETE") return reply({ ok: true })
        return reply(lead)
      }
      return reply({ items: [lead], page: 1, pageSize: 20, total: 1 })
    })
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

function renderAs(roles: Role[], ui: React.ReactNode) {
  render(
    <AdminShell
      queryClient={makeQueryClient()}
      site={{ url: "http://localhost:3000", env: "development" }}
      session={{
        user: {
          id: "u",
          name: "Ian Intake",
          email: "ian@x.test",
          title: null,
          twoFactorEnabled: true,
        },
        roles,
        impersonatedBy: null,
      }}
    >
      {ui}
    </AdminShell>
  )
}

/** Stubs the blob download; returns the clicked <a download> names. */
function captureDownloads() {
  const saved: string[] = []
  Object.assign(URL, {
    createObjectURL: vi.fn(() => "blob:csv"),
    revokeObjectURL: vi.fn(),
  })
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    saved.push(this.download)
  })
  return saved
}

describe("leads inbox (master 7.4)", () => {
  it("lists leads with status, link to the detail page, filters and CSV export", async () => {
    search = "status=new&assignee=none"
    const user = userEvent.setup()
    const saved = captureDownloads()
    renderAs(["intake"], <LeadsScreen />)
    const table = await screen.findByRole("table", { name: "Leads" })
    const link = await within(table).findByRole("link", { name: "Dinn Rí" })
    expect(link).toHaveAttribute("href", `/admin/leads/${ID}`)
    expect(within(table).getByText("New")).toBeInTheDocument()
    expect(within(table).getByText("Unassigned")).toBeInTheDocument()
    expect(screen.getByLabelText("Status")).toHaveValue("new")
    expect(screen.getByLabelText("Assignee")).toHaveValue("none")
    expect(
      calls.some(
        (c) => c.url.includes("status=new") && c.url.includes("assignee=none")
      )
    ).toBe(true)

    await user.click(screen.getByRole("button", { name: "Export CSV" }))
    await waitFor(() => expect(saved).toEqual(["leads-2026-10-16.csv"]))
    expect(calls.some((c) => c.url.includes("/leads/export.csv"))).toBe(true)
    expect(calls.find((c) => c.url.includes("export.csv"))!.url).toBe(
      "/api/v1/admin/leads/export.csv?status=new&assignee=none"
    )

    await user.selectOptions(screen.getByLabelText("Status"), "spam")
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes("status=spam"))).toBe(true)
    )
    // The filters follow the URL, so a reload keeps them.
    expect(replace).toHaveBeenLastCalledWith(
      "/admin/leads?status=spam&assignee=none",
      { scroll: false }
    )
    await user.selectOptions(screen.getByLabelText("Assignee"), "")
    expect(replace).toHaveBeenLastCalledWith("/admin/leads?status=spam", {
      scroll: false,
    })

    // The search goes into the export too.
    await user.type(screen.getByRole("searchbox"), "Dinn")
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes("q=Dinn"))).toBe(true)
    )
    await user.click(screen.getByRole("button", { name: "Export CSV" }))
    await waitFor(() =>
      expect(
        calls.filter((c) => c.url.includes("export.csv")).at(-1)!.url
      ).toBe("/api/v1/admin/leads/export.csv?status=spam&q=Dinn")
    )
  })

  it("a refused export is a toast, not a saved file", async () => {
    exportStatus = 422
    const user = userEvent.setup()
    const saved = captureDownloads()
    renderAs(["intake"], <LeadsScreen />)
    await screen.findByRole("table", { name: "Leads" })
    await user.click(screen.getByRole("button", { name: "Export CSV" }))
    expect(await screen.findByText("Export failed")).toBeInTheDocument()
    expect(
      screen.getByText(/More than 50,000 enquiries match/)
    ).toBeInTheDocument()
    expect(saved).toEqual([])
  })

  it("keeps an unknown assignee filter as “Someone else”", async () => {
    search = `assignee=${GONE}`
    renderAs(["intake"], <LeadsScreen />)
    await screen.findByRole("table", { name: "Leads" })
    const select = screen.getByLabelText("Assignee")
    await waitFor(() =>
      expect(
        within(select).getByRole("option", { name: "Ian Intake" })
      ).toBeInTheDocument()
    )
    expect(select).toHaveValue(GONE)
    expect(
      within(select).getByRole("option", { name: "Someone else" })
    ).toHaveProperty("selected", true)
    expect(calls.some((c) => c.url.includes(`assignee=${GONE}`))).toBe(true)
  })

  it("detail: vertical section tabs, message, immediate status change, notes", async () => {
    const user = userEvent.setup()
    const saved = captureDownloads()
    renderAs(["intake"], <LeadDetail id={ID} />)
    expect(
      await screen.findByRole("heading", { level: 1, name: "Dinn Rí" })
    ).toBeInTheDocument()
    const tablist = screen.getByRole("tablist", { name: "Lead sections" })
    expect(
      within(tablist)
        .getAllByRole("tab")
        .map((t) => t.textContent?.replace(/\d*, \d+ notes?$/, "").trim())
    ).toEqual(["Details", "Notes", "Activity"])
    // Read as "Notes, 1 note", not "Notes1".
    expect(
      within(tablist).getByRole("tab", { name: /^Notes,\s*1 note$/ })
    ).toBeInTheDocument()
    expect(screen.getByText(/Line one/)).toHaveClass("whitespace-pre-wrap")

    await user.selectOptions(screen.getByLabelText("Lead status"), "contacted")
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
        status: "contacted",
      })
    )
    await waitFor(() => expect(refresh).toHaveBeenCalled())

    await user.click(within(tablist).getByRole("tab", { name: /Notes/ }))
    const panel = () => screen.getByRole("tabpanel")
    expect(within(panel()).getByText("Rang back")).toBeInTheDocument()
    const box = screen.getByLabelText("Add a note")
    await user.type(box, "Sent a quote")
    await user.click(screen.getByRole("button", { name: "Add note" }))
    await waitFor(() =>
      expect(calls.find((c) => c.method === "POST")?.body).toEqual({
        body: "Sent a quote",
      })
    )
    expect(await within(panel()).findByText("Sent a quote")).toBeInTheDocument()
    // Focus goes back to the (now empty) box, not to the page.
    await waitFor(() => expect(box).toHaveFocus())
    expect(box).toHaveValue("")

    await user.click(within(tablist).getByRole("tab", { name: "Activity" }))
    expect(within(panel()).getByText("Sent from /contact")).toBeInTheDocument()
    expect(within(panel()).getByText(/^Website ·/)).toBeInTheDocument()

    // intake cannot delete (lead:delete is owner/admin)
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull()
    await user.click(
      screen.getByRole("button", { name: "Export this person's data" })
    )
    await waitFor(() => expect(saved).toHaveLength(1))
    expect(calls.find((c) => c.url.includes("export.csv"))!.url).toBe(
      "/api/v1/admin/leads/export.csv?status=all&email=dinn%40example.ie"
    )
  })

  it("status select keeps focus and stays enabled while saving; saves run in order", async () => {
    const user = userEvent.setup()
    let release!: () => void
    holdPatch = new Promise((resolve) => (release = resolve))
    renderAs(["intake"], <LeadDetail id={ID} />)
    const select = await screen.findByLabelText("Lead status")
    const card = screen.getByRole("region", { name: "Handling" })
    select.focus()
    await user.selectOptions(select, "contacted")
    await user.selectOptions(select, "qualified")
    // Both choices show at once; the first save is still waiting.
    expect(select).toHaveValue("qualified")
    expect(select).toBeEnabled()
    expect(select).toHaveFocus()
    expect(card).toHaveAttribute("aria-busy", "true")
    // Scoped: the second PATCH waits for the first.
    expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(1)
    release()
    await waitFor(() =>
      expect(
        calls.filter((c) => c.method === "PATCH").map((c) => c.body)
      ).toEqual([{ status: "contacted" }, { status: "qualified" }])
    )
    await waitFor(() => expect(card).not.toHaveAttribute("aria-busy"))
    // The older reply never overwrote the newer choice.
    expect(select).toHaveValue("qualified")
    expect(select).toHaveFocus()
  })

  it("a failed save toasts and puts the select back to the server's value", async () => {
    failPatch = true
    const user = userEvent.setup()
    renderAs(["intake"], <LeadDetail id={ID} />)
    const select = await screen.findByLabelText("Lead status")
    await user.selectOptions(select, "won")
    expect(await screen.findByText("Not saved")).toBeInTheDocument()
    expect(screen.getByText("Someone else saved")).toBeInTheDocument()
    await waitFor(() => expect(select).toHaveValue("new"))
  })

  it("the sidebar's Leads item shows the server's new-leads count", () => {
    render(
      <AdminShell
        queryClient={makeQueryClient()}
        badges={{ "new-leads": 3 }}
        session={{
          user: {
            id: "u",
            name: "Ian Intake",
            email: "ian@x.test",
            title: null,
            twoFactorEnabled: true,
          },
          roles: ["intake"],
          impersonatedBy: null,
        }}
      >
        <p>Body</p>
      </AdminShell>
    )
    const nav = screen.getByRole("navigation", { name: "Admin" })
    const leads = within(nav).getByRole("link", { name: /Leads/ })
    expect(leads).toHaveAttribute("href", "/admin/leads")
    expect(leads).toHaveAttribute("aria-current", "page")
    expect(within(nav).getByLabelText("3 new leads")).toHaveTextContent("3")
  })

  it("admins can delete after confirming", async () => {
    const user = userEvent.setup()
    renderAs(["admin"], <LeadDetail id={ID} />)
    await user.click(await screen.findByRole("button", { name: "Delete" }))
    await user.click(await screen.findByRole("button", { name: "Delete lead" }))
    await waitFor(() =>
      expect(calls.some((c) => c.method === "DELETE")).toBe(true)
    )
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/leads"))
  })
})
