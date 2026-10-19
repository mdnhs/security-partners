import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Activity, type ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ href, ...props }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props} />
  ),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { toast } from "sonner"

import { IntegrationForm } from "@/components/admin/integrations/integration-form"
import { makeQueryClient } from "@/components/admin/providers"
import {
  type AdminSession,
  AdminSessionProvider,
} from "@/components/admin/session-provider"
import type { Role } from "@/lib/auth/roles"
import type { IntegrationDto } from "@/lib/schemas/api/integrations"
import type { IntegrationKey } from "@/lib/schemas/integrations"

const saved: IntegrationDto = {
  key: "integrations.smtp",
  slug: "smtp",
  label: "Email (SMTP)",
  description: "Sends invitations.",
  configured: true,
  version: 3,
  values: {
    host: "smtp.example.ie",
    port: 587,
    secure: false,
    user: "mailer@example.ie",
    fromName: "Security Partners",
    fromAddress: "no-reply@example.ie",
  },
  secrets: { password: { set: true, hint: "••••1234" } },
  updatedAt: "2026-10-16T10:00:00.000Z",
  updatedBy: { id: "u1", name: "Olive Owner" },
}

const notSetUp: IntegrationDto = {
  key: "integrations.r2",
  slug: "r2",
  label: "Media storage (Cloudflare R2)",
  description: "Keeps uploads.",
  configured: false,
  version: 0,
  values: { accountId: "", jurisdiction: "default", bucket: "" },
  secrets: {
    accessKeyId: { set: false, hint: null },
    secretAccessKey: { set: false, hint: null },
  },
  updatedAt: null,
  updatedBy: null,
}

type Call = { url: string; method: string; body: unknown }
let calls: Call[]
let respond: (call: Call) => Response

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

const problem = (
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {}
) => json({ error: { code, message, requestId: "r", ...extra } }, status)

beforeEach(() => {
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
  calls = []
  respond = () => json(saved)
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const call = {
        url: String(input),
        method: init?.method ?? "GET",
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      }
      calls.push(call)
      return respond(call)
    })
  )
})

const aiSaved: IntegrationDto = {
  key: "integrations.ai",
  slug: "ai",
  label: "AI assistant",
  description: "Writing help.",
  configured: true,
  version: 1,
  values: {
    enabled: false,
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    allowedRoles: ["owner"],
  },
  secrets: { apiKey: { set: true, hint: "••••abcd" } },
  updatedAt: "2026-10-16T10:00:00.000Z",
  updatedBy: null,
}

let currentRoles: Role[] = ["owner"]
function wrap(ui: React.ReactNode) {
  const session: AdminSession = {
    user: {
      id: "u1",
      name: "Olive Owner",
      email: "o@example.test",
      title: null,
      twoFactorEnabled: true,
    },
    roles: currentRoles,
    impersonatedBy: null,
  }
  return (
    <QueryClientProvider client={client}>
      <AdminSessionProvider value={session}>{ui}</AdminSessionProvider>
    </QueryClientProvider>
  )
}
let client = makeQueryClient()

function renderForm(
  roles: Role[] = ["owner"],
  integrationKey: IntegrationKey = "integrations.smtp"
) {
  currentRoles = roles
  client = makeQueryClient()
  // Inside <Activity> (as Next keeps routes), so a test can hide it.
  return render(
    wrap(
      <Activity mode="visible">
        <IntegrationForm integrationKey={integrationKey} />
      </Activity>
    )
  )
}

const puts = () => calls.filter((c) => c.method === "PUT")

describe("IntegrationForm (master 7.1)", () => {
  it("shows saved values and the secret as text, never in the input", async () => {
    renderForm()
    expect(await screen.findByLabelText("SMTP server")).toHaveValue(
      "smtp.example.ie"
    )
    const password = screen.getByLabelText("Password")
    expect(password).toHaveValue("")
    expect(password).toHaveAttribute("type", "password")
    expect(password).toHaveAttribute("autocomplete", "new-password")
    expect(password).not.toHaveAttribute(
      "placeholder",
      expect.stringMatching(/1234/)
    )
    expect(screen.getByText("Saved · ends in 1234")).toBeVisible()
    expect(screen.getByLabelText(/User name/)).toHaveValue("mailer@example.ie")
    expect(screen.getByText("(optional)")).toBeVisible()
    // Unavailable buttons stay focusable (aria-disabled, WCAG 2.4.3).
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "aria-disabled",
      "true"
    )
    expect(
      screen.getByRole("button", { name: "Test connection" })
    ).not.toHaveAttribute("aria-disabled")
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeEnabled()
  })

  it("keeps password managers out of the secrets and the user name", async () => {
    renderForm()
    const password = await screen.findByLabelText("Password")
    for (const input of [password, screen.getByLabelText(/User name/)]) {
      expect(input).toHaveAttribute("data-1p-ignore")
      expect(input).toHaveAttribute("data-lpignore", "true")
      expect(input).toHaveAttribute("data-bwignore")
      expect(input).toHaveAttribute("data-form-type", "other")
    }
    expect(screen.getByLabelText("SMTP server")).not.toHaveAttribute(
      "data-1p-ignore"
    )
    expect(password.closest("form")).toHaveAttribute("autocomplete", "off")
  })

  it("a typed secret does not survive the screen being hidden", async () => {
    const user = userEvent.setup()
    const { rerender } = renderForm()
    await user.type(await screen.findByLabelText("Password"), "half-typed")
    rerender(
      wrap(
        <Activity mode="hidden">
          <IntegrationForm integrationKey="integrations.smtp" />
        </Activity>
      )
    )
    rerender(
      wrap(
        <Activity mode="visible">
          <IntegrationForm integrationKey="integrations.smtp" />
        </Activity>
      )
    )
    await waitFor(() =>
      expect(screen.getByLabelText("Password")).toHaveValue("")
    )
  })

  it("says only “Saved” when the secret has no hint", async () => {
    respond = () =>
      json({ ...saved, secrets: { password: { set: true, hint: null } } })
    renderForm()
    await screen.findByLabelText("SMTP server")
    expect(screen.getByText("Saved", { exact: true })).toBeVisible()
    expect(screen.queryByText(/ends in/)).toBeNull()
  })

  it("never set up: defaults, no secret saved, no test or disconnect", async () => {
    respond = () => json(notSetUp)
    renderForm(["owner"], "integrations.r2")
    expect(
      await screen.findByRole("combobox", { name: "Location" })
    ).toHaveTextContent("Default")
    expect(screen.getByText("Not set up")).toBeVisible()
    expect(screen.getAllByText("Not saved yet")).toHaveLength(2)
    expect(screen.queryByRole("button", { name: "Test connection" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Disconnect" })).toBeNull()
  })

  it("an empty secret is not sent; a typed one is", async () => {
    const user = userEvent.setup()
    let version = 3
    respond = (call) =>
      call.method === "PUT"
        ? json({
            ...saved,
            version: ++version,
            values: {
              ...saved.values,
              ...(call.body as { values: object }).values,
            },
          })
        : json(saved)
    renderForm()
    const name = await screen.findByLabelText("Sender name")
    await user.clear(name)
    await user.type(name, "SP Alerts")
    const testButton = screen.getByRole("button", { name: "Test connection" })
    expect(testButton).toHaveAttribute("aria-disabled", "true")
    await user.click(testButton)
    expect(calls.some((c) => c.url.endsWith("/test"))).toBe(false)
    expect(screen.getByText("Save your changes to test them.")).toBeVisible()
    const save = screen.getByRole("button", { name: "Save" })
    await user.click(save)
    await waitFor(() => expect(puts()).toHaveLength(1))
    // Saved: Save is unavailable again but keeps focus.
    await waitFor(() => expect(save).toHaveAttribute("aria-disabled", "true"))
    expect(document.activeElement).toBe(save)
    await user.click(save)
    expect(puts()).toHaveLength(1)
    const put = puts()[0]!
    expect(put.url).toContain("/integrations/integrations.smtp")
    expect(put.body).toEqual({
      version: 3,
      values: { ...saved.values, fromName: "SP Alerts" },
    })

    calls = []
    await user.type(screen.getByLabelText("Password"), "new-secret-9999")
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(puts()).toHaveLength(1))
    expect((puts()[0]!.body as { values: object }).values).toMatchObject({
      password: "new-secret-9999",
    })
  })

  it("shows 422 field errors under their fields", async () => {
    const user = userEvent.setup()
    respond = (call) =>
      call.method === "PUT"
        ? problem(422, "VALIDATION_FAILED", "Check the highlighted fields", {
            fieldErrors: { port: ["Between 1 and 65535"] },
          })
        : json(saved)
    renderForm()
    const port = await screen.findByLabelText("Port")
    await user.clear(port)
    await user.type(port, "0")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByText("Between 1 and 65535")).toBeVisible()
    expect(port).toHaveAttribute("aria-invalid", "true")
    expect(port).toHaveAccessibleDescription(/Between 1 and 65535/)
    expect(port).toHaveFocus()
  })

  it("a new server with the saved password: asks for it again and focuses it", async () => {
    const user = userEvent.setup()
    respond = (call) =>
      call.method === "PUT"
        ? problem(422, "VALIDATION_FAILED", "Check the highlighted fields", {
            fieldErrors: {
              password: ["Enter the password again for the new server"],
            },
          })
        : json(saved)
    renderForm()
    const host = await screen.findByLabelText("SMTP server")
    await user.clear(host)
    await user.type(host, "smtp2.example.ie")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(
      await screen.findByText("Enter the password again for the new server")
    ).toBeVisible()
    const password = screen.getByLabelText("Password")
    expect(password).toHaveAttribute("aria-invalid", "true")
    expect(password).toHaveFocus()
    // The typed host stays; nothing was saved.
    expect(host).toHaveValue("smtp2.example.ie")
  })

  it("Test connection: the server's message in a polite live region, nothing else", async () => {
    const user = userEvent.setup()
    respond = (call) =>
      call.url.endsWith("/test")
        ? json({
            ok: false,
            message: "Could not connect to the server (smtp.example.ie:587).",
            testedAt: "2026-10-16T10:00:00.000Z",
            detail: "raw provider text",
          })
        : json(saved)
    renderForm()
    const region = await screen.findByRole("status", {
      name: "Connection test",
    })
    expect(region).toHaveAttribute("aria-live", "polite")
    expect(region).toBeEmptyDOMElement()
    const testButton = screen.getByRole("button", { name: "Test connection" })
    await user.click(testButton)
    await waitFor(() =>
      expect(region).toHaveTextContent(
        "Could not connect to the server (smtp.example.ie:587)."
      )
    )
    // Focus stays on the button through pending and result.
    expect(document.activeElement).toBe(testButton)
    expect(region).toHaveTextContent(/^Test failed/)
    expect(screen.queryByText(/raw provider text/)).toBeNull()

    respond = (call) =>
      call.url.endsWith("/test")
        ? json({
            ok: true,
            message: "Connected to smtp.example.ie:587.",
            testedAt: "2026-10-16T10:00:00.000Z",
          })
        : json(saved)
    await user.click(screen.getByRole("button", { name: "Test connection" }))
    await waitFor(() =>
      expect(region).toHaveTextContent("Connected to smtp.example.ie:587.")
    )
  })

  it("Disconnect confirms, sends the version and shows “Not set up”", async () => {
    const user = userEvent.setup()
    let deleted = false
    respond = (call) => {
      if (call.method === "DELETE") {
        deleted = true
        return json({ ok: true })
      }
      return json(deleted ? { ...notSetUp, ...smtpCleared } : saved)
    }
    renderForm()
    await user.click(await screen.findByRole("button", { name: "Disconnect" }))
    const dialog = screen.getByRole("alertdialog", {
      name: "Disconnect Email (SMTP)?",
    })
    await user.click(within(dialog).getByRole("button", { name: "Disconnect" }))
    await waitFor(() =>
      expect(calls.find((c) => c.method === "DELETE")?.url).toContain(
        "/integrations/integrations.smtp?version=3"
      )
    )
    expect(await screen.findByText("Not set up")).toBeVisible()
    expect(toast.success).toHaveBeenCalledWith("Disconnected")
    // Disconnect is gone: focus lands on the status, not the page.
    await waitFor(() =>
      expect(document.activeElement).toHaveAttribute(
        "data-slot",
        "integration-status"
      )
    )
    expect(document.activeElement).toHaveTextContent("Not set up")
  })

  it("Disconnect on a stale version takes their version, with a toast", async () => {
    const user = userEvent.setup()
    const theirs = {
      ...saved,
      version: 4,
      values: { ...saved.values, host: "their.example.ie" },
    }
    respond = (call) =>
      call.method === "DELETE"
        ? problem(409, "CONFLICT", "Changed by someone else", {
            current: theirs,
          })
        : json(saved)
    renderForm()
    await user.click(await screen.findByRole("button", { name: "Disconnect" }))
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Disconnect",
      })
    )
    await waitFor(() =>
      expect(screen.getByLabelText("SMTP server")).toHaveValue(
        "their.example.ie"
      )
    )
    expect(toast.error).toHaveBeenCalledWith(
      "Not disconnected",
      expect.objectContaining({
        description:
          "Someone else changed these settings — the form now shows their version. Enter any new secret again.",
      })
    )
    expect(screen.queryByRole("alertdialog")).toBeNull()
  })

  it("Disconnect refused (R2 still stores files): the reason as a toast", async () => {
    const user = userEvent.setup()
    respond = (call) =>
      call.method === "DELETE"
        ? problem(
            409,
            "CONFLICT",
            "3 uploaded files are stored in R2. Delete them from the media library first, or keep R2 connected."
          )
        : json(saved)
    renderForm()
    await user.click(await screen.findByRole("button", { name: "Disconnect" }))
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Disconnect",
      })
    )
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Not disconnected",
        expect.objectContaining({
          description: expect.stringMatching(/^3 uploaded files are stored/),
        })
      )
    )
    expect(screen.getByLabelText("SMTP server")).toHaveValue("smtp.example.ie")
  })

  it("Save on a stale version takes their version, with a toast", async () => {
    const user = userEvent.setup()
    const theirs = {
      ...saved,
      version: 4,
      values: { ...saved.values, fromName: "Their name" },
    }
    respond = (call) =>
      call.method === "PUT"
        ? problem(409, "CONFLICT", "Changed by someone else", {
            current: theirs,
          })
        : json(saved)
    renderForm()
    const name = await screen.findByLabelText("Sender name")
    await user.clear(name)
    await user.type(name, "Mine")
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(name).toHaveValue("Their name"))
    expect(toast.error).toHaveBeenCalledWith(
      "Not saved",
      expect.objectContaining({
        description:
          "Someone else changed these settings — the form now shows their version. Enter any new secret again.",
      })
    )
  })

  it("a roles error marks the checkboxes, not the fieldset", async () => {
    const user = userEvent.setup()
    respond = (call) =>
      call.method === "PUT"
        ? problem(422, "VALIDATION_FAILED", "Check the highlighted fields", {
            fieldErrors: { "allowedRoles.0": ["Not allowed"] },
          })
        : json(aiSaved)
    renderForm(["owner"], "integrations.ai")
    await user.click(
      await screen.findByRole("switch", { name: "Turn on the assistant" })
    )
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByText("Not allowed")).toBeVisible()
    const group = screen.getByRole("group", { name: "Who can use it" })
    expect(group).not.toHaveAttribute("aria-invalid")
    const boxes = within(group).getAllByRole("checkbox")
    for (const box of boxes) expect(box).toHaveAttribute("aria-invalid", "true")
    expect(boxes[0]).toHaveFocus()
  })

  it("read-only without integration:update", async () => {
    renderForm(["viewer"])
    expect(await screen.findByLabelText("SMTP server")).toBeDisabled()
    expect(screen.getByLabelText("Password")).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Disconnect" })).toBeNull()
  })
})

const smtpCleared = {
  key: "integrations.smtp",
  slug: "smtp",
  label: "Email (SMTP)",
  values: {
    host: "",
    port: 587,
    secure: false,
    user: "",
    fromName: "Security Partners",
    fromAddress: "",
  },
  secrets: { password: { set: false, hint: null } },
}

describe("IntegrationForm refreshes the AI assistant status (Phase 9)", () => {
  it("invalidates ['ai', 'status'] after a save", async () => {
    const client = makeQueryClient()
    const invalidate = vi.spyOn(client, "invalidateQueries")
    respond = (call) =>
      call.method === "PUT" ? json({ ...saved, version: 4 }) : json(saved)
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={client}>
        <AdminSessionProvider
          value={{
            user: {
              id: "u1",
              name: "Olive Owner",
              email: "o@example.test",
              title: null,
              twoFactorEnabled: true,
            },
            roles: ["owner"],
            impersonatedBy: null,
          }}
        >
          <IntegrationForm integrationKey="integrations.smtp" />
        </AdminSessionProvider>
      </QueryClientProvider>
    )
    await user.type(await screen.findByLabelText("SMTP server"), "x")
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["ai", "status"] })
    )
  })
})
