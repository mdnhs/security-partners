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

const ROW: RedirectDto = {
  id: "00000000-0000-7000-8000-0000000000aa",
  fromPath: "/old-alarms",
  toPath: "/services/alarm-responses",
  code: 301,
  hits: 1234,
  createdAt: "2026-10-01T09:00:00.000Z",
  updatedAt: "2026-10-01T09:00:00.000Z",
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

const fetchMock = vi.fn(
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    const method = init?.method ?? "GET"
    if (method === "GET" && url.pathname === "/api/v1/admin/redirects")
      return json(200, { items: [ROW], page: 1, pageSize: 20, total: 1 })
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
    if (method === "DELETE") return json(200, { ok: true })
    return json(404, { error: { code: "NOT_FOUND", message: "x" } })
  }
)

const toastError = vi.spyOn(toast, "error")

beforeEach(() => {
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
    await user.selectOptions(within(dialog).getByLabelText("Type"), "302")
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
    })
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
