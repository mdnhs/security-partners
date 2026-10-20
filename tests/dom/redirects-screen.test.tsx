import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/seo/redirects",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import { makeQueryClient } from "@/components/admin/providers"
import { RedirectsScreen } from "@/components/admin/seo/redirects-screen"
import { AdminSessionProvider } from "@/components/admin/session-provider"
import type { Role } from "@/lib/auth/roles"
import type { RedirectDto } from "@/lib/schemas/api/redirects"

import { pickOption } from "./select-helper"

const ROW: RedirectDto = {
  id: "00000000-0000-7000-8000-0000000000aa",
  fromPath: "/old-alarms",
  toPath: "/services/alarm-responses",
  code: 301,
  hits: 1234,
  lastHitAt: null,
  isActive: true,
  note: "",
  source: "manual",
  createdAt: "2026-10-01T09:00:00.000Z",
  updatedAt: "2026-10-01T09:00:00.000Z",
}

const AUTO_ROW: RedirectDto = {
  id: "00000000-0000-7000-8000-0000000000bb",
  fromPath: "/services/coming-soon",
  toPath: "/services",
  code: 308,
  hits: 3,
  lastHitAt: "2026-10-01T08:00:00.000Z",
  isActive: false,
  note: "Old brochure link",
  source: "auto",
  createdAt: "2026-10-01T09:00:00.000Z",
  updatedAt: "2026-10-01T09:00:00.000Z",
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

const OK_ROWS = [
  {
    line: 2,
    from: "/promo",
    to: "/contact",
    code: 301,
    note: "",
    status: "create",
  },
  {
    line: 3,
    from: "/old-alarms",
    to: "/services",
    code: 302,
    note: "",
    status: "update",
  },
]
const BAD_ROWS = [
  OK_ROWS[0],
  {
    line: 4,
    from: "/promo",
    to: "/about",
    code: 301,
    note: "",
    status: "error",
    message: "/promo is already in this file (line 2)",
  },
]

/** POST /redirects/import: a file containing "bad" has an error row. */
let importReplyOverride:
  | ((body: {
      csv: string
      mode: string
    }) => Response | Promise<Response> | null)
  | null = null

function importReply(body: { csv: string; mode: string }) {
  const override = importReplyOverride?.(body)
  if (override) return override
  if (body.csv.includes("broken"))
    return json(422, {
      error: {
        code: "VALIDATION_FAILED",
        message: "Line 2: a quoted value is never closed. Check its quotes.",
        fieldErrors: { csv: ["Line 2: a quoted value is never closed."] },
      },
    })
  const bad = body.csv.includes("bad")
  if (body.mode === "commit" && bad)
    return json(422, {
      error: {
        code: "VALIDATION_FAILED",
        message: "1 row needs fixing. Nothing was imported.",
        current: { rows: BAD_ROWS },
      },
    })
  return bad
    ? json(200, { rows: BAD_ROWS, created: 1, updated: 0 })
    : json(200, { rows: OK_ROWS, created: 1, updated: 1 })
}

const csvFile = (text: string) =>
  new File([text], "redirects.csv", { type: "text/csv" })

/** While set, every PATCH waits for it (requests in flight). */
let hold: Promise<void> | null = null

const fetchMock = vi.fn(
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    const method = init?.method ?? "GET"
    if (method === "GET" && url.pathname === "/api/v1/admin/redirects")
      return json(200, {
        items: [ROW, AUTO_ROW],
        page: 1,
        pageSize: 20,
        total: 2,
      })
    if (method === "PATCH") {
      if (hold) await hold
      const body = JSON.parse(String(init!.body)) as Partial<RedirectDto>
      if (url.pathname.endsWith(AUTO_ROW.id) && body.isActive === true)
        return json(422, {
          error: {
            code: "VALIDATION_FAILED",
            message: "That address is a live page now",
            fieldErrors: { isActive: ["That address is a live page now"] },
          },
        })
      return json(200, { ...ROW, ...body })
    }
    if (method === "POST" && url.pathname === "/api/v1/admin/redirects") {
      const body = JSON.parse(String(init!.body)) as { toPath: string }
      if (body.toPath === "/old-alarms")
        return json(422, {
          error: {
            code: "VALIDATION_FAILED",
            message: "This would loop",
            fieldErrors: { toPath: ["This would loop: /a → /old-alarms → /a"] },
          },
        })
      if (body.toPath === "/code-error")
        return json(422, {
          error: {
            code: "VALIDATION_FAILED",
            message: "Choose permanent or temporary",
            fieldErrors: { code: ["Choose permanent or temporary"] },
          },
        })
      return json(201, { ...ROW, id: "new", ...body })
    }
    if (method === "POST" && url.pathname === "/api/v1/admin/redirects/import")
      return importReply(
        JSON.parse(String(init!.body)) as { csv: string; mode: string }
      )
    if (method === "DELETE") return json(200, { ok: true })
    return json(404, { error: { code: "NOT_FOUND", message: "x" } })
  }
)

const toastError = vi.spyOn(toast, "error")

beforeEach(() => {
  hold = null
  importReplyOverride = null
  toastError.mockClear()
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
        <RedirectsScreen />
      </AdminSessionProvider>
    </QueryClientProvider>
  )

describe("Redirects screen (master 8.2)", () => {
  it("lists redirects with type, hits and actions for marketers", async () => {
    renderAs(["marketer"])
    const table = await screen.findByRole("table", { name: "Redirects" })
    expect(within(table).getByText("/old-alarms")).toBeInTheDocument()
    expect(
      within(table).getByText("/services/alarm-responses")
    ).toBeInTheDocument()
    expect(within(table).getByText("Permanent (301)")).toBeInTheDocument()
    expect(within(table).getByText("1,234")).toBeInTheDocument()
    expect(
      within(table).getByRole("button", {
        name: "Edit redirect from /old-alarms",
      })
    ).toBeInTheDocument()
  })

  it("viewers get no add, edit or delete", async () => {
    renderAs(["viewer"])
    await screen.findByRole("table", { name: "Redirects" })
    expect(screen.queryByRole("button", { name: "Add redirect" })).toBeNull()
    expect(screen.queryByRole("button", { name: /^Edit redirect/ })).toBeNull()
    expect(
      screen.queryByRole("button", { name: /^Delete redirect/ })
    ).toBeNull()
  })

  it("adding shows field errors from the API (loop)", async () => {
    const user = userEvent.setup()
    renderAs(["marketer"])
    await user.click(
      await screen.findByRole("button", { name: "Add redirect" })
    )
    const dialog = screen.getByRole("dialog", { name: "Add redirect" })
    await user.type(within(dialog).getByLabelText("Old address"), "/a")
    await user.type(within(dialog).getByLabelText("New address"), "/old-alarms")
    await user.click(
      within(dialog).getByRole("button", { name: "Add redirect" })
    )
    expect(
      await within(dialog).findByText("This would loop: /a → /old-alarms → /a")
    ).toBeInTheDocument()
    expect(within(dialog).getByLabelText("New address")).toHaveAttribute(
      "aria-invalid",
      "true"
    )
    // Focus moves to the invalid field, so its error is announced.
    expect(within(dialog).getByLabelText("New address")).toHaveFocus()
    expect(toastError).not.toHaveBeenCalled()
  })

  it("an error with no inline field (code) is a toast, not lost", async () => {
    const user = userEvent.setup()
    renderAs(["marketer"])
    await user.click(
      await screen.findByRole("button", { name: "Add redirect" })
    )
    const dialog = screen.getByRole("dialog", { name: "Add redirect" })
    await user.type(within(dialog).getByLabelText("Old address"), "/b")
    await user.type(within(dialog).getByLabelText("New address"), "/code-error")
    await user.click(
      within(dialog).getByRole("button", { name: "Add redirect" })
    )
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Not saved", {
        description: "Choose permanent or temporary",
      })
    )
    expect(screen.getByRole("dialog", { name: "Add redirect" })).toBeVisible()
  })

  it("adding a valid redirect posts it and closes the dialog", async () => {
    const user = userEvent.setup()
    renderAs(["marketer"])
    await user.click(
      await screen.findByRole("button", { name: "Add redirect" })
    )
    const dialog = screen.getByRole("dialog", { name: "Add redirect" })
    await user.type(within(dialog).getByLabelText("Old address"), "/promo")
    await user.type(within(dialog).getByLabelText("New address"), "/contact")
    await pickOption(
      user,
      within(dialog).getByLabelText("Type"),
      "Temporary (302) — it will come back"
    )
    await user.type(within(dialog).getByLabelText("Note"), "  Spring flyer ")
    await user.click(
      within(dialog).getByRole("button", { name: "Add redirect" })
    )
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Add redirect" })).toBeNull()
    )
    const post = fetchMock.mock.calls.find(
      ([, init]) => init?.method === "POST"
    )!
    expect(JSON.parse(String(post[1]!.body))).toEqual({
      fromPath: "/promo",
      toPath: "/contact",
      code: 302,
      note: "Spring flyer",
    })
  })

  it("lists last hit, On/Off, the Automatic badge and the note (D1.7)", async () => {
    renderAs(["marketer"])
    const table = await screen.findByRole("table", { name: "Redirects" })
    const [, manual, auto] = within(table).getAllByRole("row")
    expect(within(manual).getByText("Never")).toBeInTheDocument()
    expect(within(manual).getByText("On")).toBeInTheDocument()
    expect(within(manual).queryByText("Automatic")).toBeNull()
    expect(within(auto).getByText("Off")).toBeInTheDocument()
    expect(within(auto).getByText("Automatic")).toBeInTheDocument()
    expect(within(auto).getByText("Old brochure link")).toBeInTheDocument()
    expect(within(auto).getByText("Permanent (308)")).toBeInTheDocument()
    expect(
      auto.querySelector(`time[datetime="${AUTO_ROW.lastHitAt}"]`)
    ).not.toBeNull()
    expect(
      within(table).getByRole("columnheader", { name: /Last hit/ })
    ).toBeInTheDocument()
  })

  it("Turn off patches isActive; turning on a live address shows the reason", async () => {
    const user = userEvent.setup()
    renderAs(["marketer"])
    const table = await screen.findByRole("table", { name: "Redirects" })
    await user.click(
      within(table).getByRole("button", {
        name: "Turn off redirect from /old-alarms",
      })
    )
    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(
        ([, init]) => init?.method === "PATCH"
      )!
      expect(String(patch[0])).toContain(`/redirects/${ROW.id}`)
      expect(JSON.parse(String(patch[1]!.body))).toEqual({ isActive: false })
    })
    await user.click(
      within(table).getByRole("button", {
        name: "Turn on redirect from /services/coming-soon",
      })
    )
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Not turned on", {
        description: "That address is a live page now",
      })
    )
  })

  it("the type select offers 301, 302, 307 and 308 with help", async () => {
    const user = userEvent.setup()
    renderAs(["marketer"])
    await user.click(
      await screen.findByRole("button", { name: "Add redirect" })
    )
    const dialog = screen.getByRole("dialog", { name: "Add redirect" })
    const type = within(dialog).getByLabelText("Type")
    expect(type).toHaveAccessibleDescription(/307 and 308/)
    await user.click(type)
    const options = (await screen.findAllByRole("option")).map((o) =>
      o.textContent?.trim()
    )
    expect(options).toEqual([
      "Permanent (301) — the page moved for good",
      "Temporary (302) — it will come back",
      "Temporary, keep method (307) — for forms and APIs",
      "Permanent, keep method (308) — for forms and APIs",
    ])
  })

  it("a toggle in flight keeps focus; every in-flight row is guarded (review D1.7 M2/M4)", async () => {
    const user = userEvent.setup()
    let release!: () => void
    hold = new Promise<void>((resolve) => (release = resolve))
    renderAs(["marketer"])
    const table = await screen.findByRole("table", { name: "Redirects" })
    const first = within(table).getByRole("button", {
      name: "Turn off redirect from /old-alarms",
    })
    const second = within(table).getByRole("button", {
      name: "Turn on redirect from /services/coming-soon",
    })
    await user.click(first)
    expect(first).toHaveFocus()
    expect(first).not.toBeDisabled()
    expect(first).toHaveAttribute("aria-disabled", "true")
    await user.click(second)
    // The first row is still in flight: still guarded, and a second press
    // sends nothing.
    expect(first).toHaveAttribute("aria-disabled", "true")
    expect(second).toHaveAttribute("aria-disabled", "true")
    await user.click(first)
    await user.click(second)
    const patches = () =>
      fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")
    expect(patches()).toHaveLength(2)
    release()
    await waitFor(() => expect(first).not.toHaveAttribute("aria-disabled"))
    await waitFor(() => expect(second).not.toHaveAttribute("aria-disabled"))
  })

  it("explains the Automatic badge without hover (review D1.7 M3)", async () => {
    renderAs(["marketer"])
    await screen.findByRole("table", { name: "Redirects" })
    expect(screen.getByText(/marked Automatic/)).toBeVisible()
  })

  it("Export CSV for readers; Import CSV only for those who can add redirects (D1.8)", async () => {
    renderAs(["viewer"])
    await screen.findByRole("table", { name: "Redirects" })
    expect(screen.getByRole("button", { name: "Export CSV" })).toHaveAttribute(
      "data-href",
      "/api/v1/admin/redirects/export.csv"
    )
    expect(screen.queryByRole("button", { name: "Import CSV" })).toBeNull()
  })

  it("import previews each row, blocks a file with errors, then imports a clean one (D1.8)", async () => {
    const user = userEvent.setup()
    renderAs(["marketer"])
    await user.click(await screen.findByRole("button", { name: "Import CSV" }))
    const dialog = screen.getByRole("dialog", { name: "Import redirects" })
    const importButton = () =>
      within(dialog).getByRole("button", { name: /^Import( \d+ redirects?)?$/ })

    // A file that is not valid CSV: the reason shows inline.
    await user.upload(
      within(dialog).getByLabelText("CSV file"),
      csvFile('from,to\n/a,"broken')
    )
    expect(
      await within(dialog).findByText(
        "Line 2: a quoted value is never closed. Check its quotes."
      )
    ).toBeVisible()
    expect(within(dialog).getByLabelText("CSV file")).toHaveAttribute(
      "aria-invalid",
      "true"
    )

    // A file with an error row: listed per line, nothing can be imported.
    await user.upload(
      within(dialog).getByLabelText("CSV file"),
      csvFile("from,to\n/promo,/contact\n/promo,/about bad")
    )
    const table = await within(dialog).findByRole("table", {
      name: "Rows in the file",
    })
    expect(
      within(table).getByText("/promo is already in this file (line 2)")
    ).toBeVisible()
    expect(
      within(dialog).getByText(/1 new · 0 updated · 1 to fix/)
    ).toBeVisible()
    expect(importButton()).toHaveAttribute("aria-disabled", "true")
    await user.click(importButton())
    expect(
      fetchMock.mock.calls.filter(([, init]) =>
        String(init?.body ?? "").includes('"commit"')
      )
    ).toHaveLength(0)

    // A clean file: Import commits it.
    await user.upload(
      within(dialog).getByLabelText("CSV file"),
      csvFile("from,to\n/promo,/contact\n/old-alarms,/services")
    )
    expect(
      await within(dialog).findByText(/1 new · 1 updated · 0 to fix/)
    ).toBeVisible()
    await user.click(
      within(dialog).getByRole("button", { name: "Import 2 redirects" })
    )
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Import redirects" })
      ).toBeNull()
    )
    const posts = fetchMock.mock.calls
      .filter(([input]) => String(input).includes("/redirects/import"))
      .map(([, init]) => JSON.parse(String(init!.body)) as { mode: string })
    expect(posts.map((p) => p.mode)).toEqual([
      "preview",
      "preview",
      "preview",
      "commit",
    ])
  })

  it("a commit refused by the server shows its rows and keeps the dialog (D1.8)", async () => {
    const user = userEvent.setup()
    renderAs(["marketer"])
    await user.click(await screen.findByRole("button", { name: "Import CSV" }))
    const dialog = screen.getByRole("dialog", { name: "Import redirects" })
    // Preview says clean, but the server finds an error at commit (a race).
    importReplyOverride = (body) =>
      body.mode === "preview"
        ? json(200, { rows: OK_ROWS, created: 1, updated: 1 })
        : null
    await user.upload(
      within(dialog).getByLabelText("CSV file"),
      csvFile("from,to\n/promo,/contact bad")
    )
    await user.click(
      await within(dialog).findByRole("button", { name: "Import 2 redirects" })
    )
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Nothing was imported", {
        description: "1 row needs fixing. Nothing was imported.",
      })
    )
    expect(
      within(dialog).getByText("/promo is already in this file (line 2)")
    ).toBeVisible()
    expect(
      screen.getByRole("dialog", { name: "Import redirects" })
    ).toBeVisible()
  })

  it("a late preview of an earlier file never replaces the current one (review D1.8 #6)", async () => {
    const user = userEvent.setup()
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    importReplyOverride = (body) =>
      body.csv.includes("/first")
        ? gate.then(() => json(200, { rows: BAD_ROWS, created: 1, updated: 0 }))
        : null
    renderAs(["marketer"])
    await user.click(await screen.findByRole("button", { name: "Import CSV" }))
    const dialog = screen.getByRole("dialog", { name: "Import redirects" })
    const input = within(dialog).getByLabelText("CSV file")
    await user.upload(input, csvFile("from,to\n/first,/contact"))
    await user.upload(input, csvFile("from,to\n/second,/contact"))
    expect(
      await within(dialog).findByText(/1 new · 1 updated · 0 to fix/)
    ).toBeVisible()
    release()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(
      within(dialog).getByText(/1 new · 1 updated · 0 to fix/)
    ).toBeVisible()
    expect(within(dialog).queryByText(/to fix/)).toHaveTextContent("0 to fix")
    expect(
      within(dialog).getByRole("button", { name: "Import 2 redirects" })
    ).toBeVisible()
  })

  it("a file whose upload would pass the 1 MB body limit is refused with the reason (review D1.8 #6)", async () => {
    const user = userEvent.setup()
    renderAs(["marketer"])
    await user.click(await screen.findByRole("button", { name: "Import CSV" }))
    const dialog = screen.getByRole("dialog", { name: "Import redirects" })
    // 600 KB of quotes: each one is sent as \" (twice the size).
    await user.upload(
      within(dialog).getByLabelText("CSV file"),
      csvFile(`from,to,note\n/a,/,"${'""'.repeat(300_000)}"`)
    )
    expect(await within(dialog).findByText(/over 1 MB once sent/)).toBeVisible()
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).includes("/redirects/import")
      )
    ).toHaveLength(0)
  })

  it("unchanged rows are labelled and counted (review D1.8 #4)", async () => {
    const user = userEvent.setup()
    importReplyOverride = () =>
      json(200, {
        rows: [{ ...OK_ROWS[1], status: "unchanged" }],
        created: 0,
        updated: 0,
        unchanged: 1,
      })
    renderAs(["marketer"])
    await user.click(await screen.findByRole("button", { name: "Import CSV" }))
    const dialog = screen.getByRole("dialog", { name: "Import redirects" })
    await user.upload(
      within(dialog).getByLabelText("CSV file"),
      csvFile("from,to\n/old-alarms,/services")
    )
    expect(
      await within(dialog).findByText(
        /0 new · 0 updated · 1 unchanged · 0 to fix/
      )
    ).toBeVisible()
    expect(within(dialog).getByText("No change")).toBeVisible()
    // Nothing to write: Import stays unavailable.
    expect(
      within(dialog).getByRole("button", { name: "Import" })
    ).toHaveAttribute("aria-disabled", "true")
  })

  it("viewers get no Turn on/off", async () => {
    renderAs(["viewer"])
    await screen.findByRole("table", { name: "Redirects" })
    expect(screen.queryByRole("button", { name: /^Turn (on|off)/ })).toBeNull()
  })

  it("delete asks first, then deletes", async () => {
    const user = userEvent.setup()
    renderAs(["marketer"])
    const table = await screen.findByRole("table", { name: "Redirects" })
    await user.click(
      within(table).getByRole("button", {
        name: "Delete redirect from /old-alarms",
      })
    )
    const confirm = screen.getByRole("alertdialog")
    await user.click(within(confirm).getByRole("button", { name: "Delete" }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/api/v1/admin/redirects/${ROW.id}`),
        expect.objectContaining({ method: "DELETE" })
      )
    )
  })

  it("a typed redirect is not dropped by Esc (final review I2)", async () => {
    const user = userEvent.setup()
    renderAs(["marketer"])
    await user.click(
      await screen.findByRole("button", { name: "Add redirect" })
    )
    const dialog = screen.getByRole("dialog", { name: "Add redirect" })
    await user.type(within(dialog).getByLabelText("Old address"), "/promo")
    await user.keyboard("{Escape}")
    const confirm = await screen.findByRole("alertdialog", {
      name: "Discard this redirect?",
    })
    // 44 px on touch screens, like Cancel beside it (I4).
    expect(
      within(confirm).getByRole("button", { name: "Discard changes" })
    ).toHaveClass("pointer-coarse:h-11")
    await user.click(
      within(confirm).getByRole("button", { name: "Keep editing" })
    )
    expect(within(dialog).getByLabelText("Old address")).toHaveValue("/promo")
  })

  it("an untouched redirect dialog closes without asking", async () => {
    const user = userEvent.setup()
    renderAs(["marketer"])
    await user.click(
      await screen.findByRole("button", { name: "Add redirect" })
    )
    await user.keyboard("{Escape}")
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Add redirect" })).toBeNull()
    )
    expect(screen.queryByRole("alertdialog")).toBeNull()
  })
})
