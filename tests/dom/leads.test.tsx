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

import { useAssistant } from "@/components/admin/ai/assistant-context"
import { LeadDetail } from "@/components/admin/leads/lead-detail"
import { LeadsScreen } from "@/components/admin/leads/leads-screen"
import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { Role } from "@/lib/auth/roles"
import type { LeadDto } from "@/lib/schemas/api/leads"

import { pickOption } from "./select-helper"

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
/** The newsletter lookup's answer for the lead's address (privacy helper). */
let onNewsletter = false

const calls: { url: string; method: string; body: unknown }[] = []
beforeEach(() => {
  calls.length = 0
  search = ""
  holdPatch = null
  failPatch = false
  exportStatus = 200
  onNewsletter = false
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
      if (url.includes("/newsletter/lookup"))
        return reply({
          subscriber: onNewsletter
            ? {
                id: "0190a6e0-0000-7000-8000-0000000000dd",
                email: body.email,
                status: "confirmed",
                sourcePath: "/blog",
                createdAt: "2026-10-01T09:00:00.000Z",
                confirmedAt: "2026-10-01T09:00:00.000Z",
                unsubscribedAt: null,
              }
            : null,
        })
      if (url.includes("/newsletter/erase")) {
        onNewsletter = false
        return reply({ erased: 1 })
      }
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
      if (url.includes(`/leads/${GONE}`))
        return reply(
          { error: { code: "NOT_FOUND", message: "Not found" } },
          404
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
    expect(screen.getByLabelText("Status")).toHaveTextContent("New")
    expect(screen.getByLabelText("Assignee")).toHaveTextContent("Unassigned")
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

    await pickOption(user, screen.getByLabelText("Status"), "Spam")
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes("status=spam"))).toBe(true)
    )
    // The filters follow the URL, so a reload keeps them.
    expect(replace).toHaveBeenLastCalledWith(
      "/admin/leads?status=spam&assignee=none",
      { scroll: false }
    )
    await pickOption(user, screen.getByLabelText("Assignee"), "Anyone")
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
    const user = userEvent.setup()
    search = `assignee=${GONE}`
    renderAs(["intake"], <LeadsScreen />)
    await screen.findByRole("table", { name: "Leads" })
    const select = screen.getByRole("combobox", { name: "Assignee" })
    expect(select).toHaveTextContent("Someone else")
    await user.click(select)
    const listbox = await screen.findByRole("listbox")
    expect(
      await within(listbox).findByRole("option", { name: "Ian Intake" })
    ).toBeInTheDocument()
    expect(
      within(listbox).getByRole("option", { name: "Someone else" })
    ).toHaveAttribute("aria-selected", "true")
    await user.keyboard("{Escape}")
    expect(select).toHaveTextContent("Someone else")
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

    await pickOption(user, screen.getByLabelText("Lead status"), "Contacted")
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
    await pickOption(user, select, "Contacted")
    await pickOption(user, select, "Qualified")
    // Both choices show at once; the first save is still waiting.
    expect(select).toHaveTextContent("Qualified")
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
    expect(select).toHaveTextContent("Qualified")
    expect(select).toHaveFocus()
  })

  it("a failed save toasts and puts the select back to the server's value", async () => {
    failPatch = true
    const user = userEvent.setup()
    renderAs(["intake"], <LeadDetail id={ID} />)
    const select = await screen.findByLabelText("Lead status")
    await pickOption(user, select, "Won")
    expect(await screen.findByText("Not saved")).toBeInTheDocument()
    expect(screen.getByText("Someone else saved")).toBeInTheDocument()
    await waitFor(() => expect(select).toHaveTextContent("New"))
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
    const leads = within(nav).getByRole("link", { name: /Enquiries/ })
    expect(leads).toHaveAttribute("href", "/admin/leads")
    expect(leads).toHaveAttribute("aria-current", "page")
    expect(within(nav).getByLabelText("3 new enquiries")).toHaveTextContent("3")
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

describe("lead detail privacy helper: newsletter (D4.3)", () => {
  const lookups = () =>
    calls.filter((c) => c.url.includes("/newsletter/lookup"))

  it("says whether the address is also on the newsletter list", async () => {
    onNewsletter = true
    renderAs(["marketer"], <LeadDetail id={ID} />)
    expect(
      await screen.findByText("Also on the newsletter list: Yes")
    ).toBeInTheDocument()
    expect(lookups()[0]).toMatchObject({
      method: "POST",
      body: { email: "dinn@example.ie" },
    })
    // A marketer may read the list but not erase from it.
    expect(
      screen.queryByRole("button", { name: "Erase from newsletter" })
    ).toBeNull()
  })

  it("No when absent; nothing at all without newsletter:read", async () => {
    renderAs(["admin"], <LeadDetail id={ID} />)
    expect(
      await screen.findByText("Also on the newsletter list: No")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Erase from newsletter" })
    ).toBeNull()
  })

  it("is not shown (nor looked up) for intake", async () => {
    renderAs(["intake"], <LeadDetail id={ID} />)
    await screen.findByRole("heading", { name: "Dinn Rí" })
    expect(screen.queryByText(/Also on the newsletter list/)).toBeNull()
    expect(lookups()).toEqual([])
  })

  it("newsletter:delete erases the address after confirming", async () => {
    onNewsletter = true
    const user = userEvent.setup()
    renderAs(["admin"], <LeadDetail id={ID} />)
    await user.click(
      await screen.findByRole("button", { name: "Erase from newsletter" })
    )
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("dinn@example.ie")
    expect(calls.some((c) => c.url.includes("/newsletter/erase"))).toBe(false)
    await user.click(within(dialog).getByRole("button", { name: "Erase" }))
    await waitFor(() =>
      expect(
        calls.find((c) => c.url.includes("/newsletter/erase"))
      ).toMatchObject({ method: "POST", body: { email: "dinn@example.ie" } })
    )
    expect(
      await screen.findByText("Also on the newsletter list: No")
    ).toBeInTheDocument()
  })
})

describe("lead detail shares the lead with the assistant (spec §8.3)", () => {
  /** Shows what the assistant would receive with the next message. */
  function SharedScreen() {
    const { screen: info, snapshot } = useAssistant()
    return (
      <output data-testid="shared">
        {info ? JSON.stringify(snapshot()) : "nothing"}
      </output>
    )
  }

  it("shares the loaded lead without contact details", async () => {
    renderAs(
      ["intake"],
      <>
        <SharedScreen />
        <LeadDetail id={ID} />
      </>
    )
    const shared = screen.getByTestId("shared")
    await waitFor(() => expect(shared).not.toHaveTextContent("nothing"))
    const sent = JSON.parse(shared.textContent!)
    expect(sent).toMatchObject({
      title: "Lead details",
      entityType: "lead",
      entityId: ID,
      record: { name: "Dinn Rí", message: "Line one\nLine two" },
    })
    expect(sent.record.notes).toEqual([
      { at: "2026-10-16T10:00:00.000Z", by: "Ian Intake", text: "Rang back" },
    ])
    expect(shared.textContent).not.toContain("dinn@example.ie")
    expect(shared.textContent).not.toContain("085 000 0000")
  })

  it("shares nothing for a lead that does not load", async () => {
    renderAs(
      ["intake"],
      <>
        <SharedScreen />
        <LeadDetail id={GONE} />
      </>
    )
    await screen.findByText("This lead does not exist")
    expect(screen.getByTestId("shared")).toHaveTextContent("nothing")
  })

  it("“All leads” returns to the list as it was left (final review I8)", async () => {
    window.sessionStorage.setItem(
      "sp-admin:list:/admin/leads",
      "status=open&assignee=me&page=3"
    )
    renderAs(["intake"], <LeadDetail id={ID} />)
    await screen.findByRole("heading", { level: 1, name: "Dinn Rí" })
    expect(screen.getByRole("link", { name: "All leads" })).toHaveAttribute(
      "href",
      "/admin/leads?status=open&assignee=me&page=3"
    )
  })

  it("filters keep the table's search and follow Back/Forward (I8, M9)", async () => {
    const user = userEvent.setup()
    search = "status=open"
    window.history.replaceState(null, "", "/admin/leads?status=open&q=Dinn")
    renderAs(["intake"], <LeadsScreen />)
    expect(await screen.findByLabelText("Status")).toHaveTextContent("Open")
    await pickOption(user, screen.getByLabelText("Status"), "Spam")
    // The search stays; the page resets.
    expect(replace).toHaveBeenLastCalledWith(
      "/admin/leads?status=spam&q=Dinn",
      { scroll: false }
    )
    // Back: the URL says "contacted" again; the screen follows it on its
    // next render (here: the search box's debounced update).
    search = "status=contacted"
    await user.type(screen.getByRole("searchbox"), "x")
    await waitFor(() =>
      expect(screen.getByLabelText("Status")).toHaveTextContent("Contacted")
    )
    search = ""
  })

  it("a note typed but not added asks before leaving (final review I2)", async () => {
    const user = userEvent.setup()
    renderAs(["intake"], <LeadDetail id={ID} />)
    await screen.findByRole("heading", { level: 1, name: "Dinn Rí" })
    await user.click(screen.getByRole("tab", { name: /^Notes/ }))
    await user.type(screen.getByLabelText("Add a note"), "Rang them")
    await user.click(screen.getByRole("link", { name: "All leads" }))
    expect(
      await screen.findByRole("alertdialog", { name: "Leave without saving?" })
    ).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })
})
