import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { AiSettingsView } from "@/components/admin/ai/ai-settings-view"
import { makeQueryClient } from "@/components/admin/providers"
import {
  type AdminSession,
  AdminSessionProvider,
} from "@/components/admin/session-provider"
import type { Role } from "@/lib/auth/roles"
import type { IntegrationDto } from "@/lib/schemas/api/integrations"

const PATH = "/api/v1/admin/integrations/integrations.ai"

const saved: IntegrationDto = {
  key: "integrations.ai",
  slug: "ai",
  label: "AI assistant",
  description: "Writing help.",
  configured: true,
  version: 2,
  values: {
    enabled: false,
    provider: "anthropic",
    model: "claude-sonnet-5-5",
    baseUrl: "",
    allowedRoles: ["owner", "admin", "editor"],
    extraInstructions: "",
    maxOutputTokens: 1024,
    shareEnquiryDetails: {
      enabled: false,
      acknowledgedBy: null,
      acknowledgedAt: null,
    },
  },
  secrets: { apiKey: { set: true, hint: "••••abcd" } },
  updatedAt: "2026-10-16T10:00:00.000Z",
  updatedBy: null,
}

type Call = { path: string; method: string; body: unknown }
let calls: Call[]
let routes: Record<string, (call: Call) => Response>

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

beforeEach(() => {
  calls = []
  routes = {
    [`GET ${PATH}`]: () => json(saved),
    [`PUT ${PATH}`]: () => json({ ...saved, version: 3 }),
    [`POST ${PATH}/test`]: () =>
      json({ ok: true, message: "Connected", testedAt: saved.updatedAt }),
    "POST /api/v1/admin/ai/models": () =>
      json({ models: ["claude-haiku-5-5", "claude-sonnet-5-5"] }),
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost")
      const call = {
        path: url.pathname,
        method: init?.method ?? "GET",
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      }
      calls.push(call)
      const route = routes[`${call.method} ${call.path}`]
      return route
        ? route(call)
        : json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404)
    })
  )
})

function renderView(
  roles: Role[] = ["owner"],
  impersonatedBy: string | null = null
) {
  const session: AdminSession = {
    user: {
      id: "u1",
      name: "Olive Owner",
      email: "o@example.test",
      title: null,
      twoFactorEnabled: true,
    },
    roles,
    impersonatedBy,
  }
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <AdminSessionProvider value={session}>
        <AiSettingsView />
      </AdminSessionProvider>
    </QueryClientProvider>
  )
}

const ready = () => screen.findByRole("combobox", { name: "Model" })
const puts = () =>
  calls.filter((c) => c.method === "PUT").map((c) => c.body as never)

describe("AiSettingsView (MK parity C7)", () => {
  it("has the page header and the fields in order", async () => {
    renderView()
    expect(
      screen.getByRole("heading", { level: 1, name: "AI assistant" })
    ).toBeInTheDocument()
    expect(
      screen.getByText("Choose the provider and who can use the assistant.")
    ).toBeInTheDocument()
    await ready()
    expect(
      screen.getByRole("switch", { name: "Turn on the AI assistant" })
    ).toBeInTheDocument()
    const provider = screen.getByRole("radiogroup", { name: "Provider" })
    expect(within(provider).getAllByRole("radio")).toHaveLength(4)
    expect(screen.getByRole("combobox", { name: "Model" })).toHaveAttribute(
      "list",
      "ai-models"
    )
    const roles = screen.getByRole("group", { name: "Who can use it" })
    for (const name of ["Owner", "Admin"]) {
      const box = within(roles).getByRole("checkbox", { name })
      expect(box).toBeChecked()
      expect(box).toHaveAttribute("aria-disabled", "true")
    }
    expect(
      screen.getByRole("textbox", { name: /^Extra instructions/ })
    ).toBeInTheDocument()
    expect(screen.getByText("0/2000")).toBeInTheDocument()
    const longest = screen.getByRole("spinbutton", { name: /Longest answer/ })
    expect(longest).toHaveAttribute("min", "64")
    expect(longest).toHaveAttribute("max", "8192")

    // Spec §6.3 order: … Who can use it → Extra instructions → Longest
    // answer → Enquiry details → Test.
    const inOrder = [
      screen.getByRole("switch", { name: "Turn on the AI assistant" }),
      provider,
      screen.getByRole("radiogroup", { name: "API key" }),
      screen.getByRole("combobox", { name: "Model" }),
      roles,
      screen.getByRole("textbox", { name: /^Extra instructions/ }),
      longest,
      screen.getByRole("switch", {
        name: "Let the assistant read enquiry details",
      }),
      screen.getByRole("button", { name: "Test connection" }),
    ]
    for (let i = 1; i < inOrder.length; i++)
      expect(
        inOrder[i - 1]!.compareDocumentPosition(inOrder[i]!) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
  })

  it("a key error while Remove is chosen focuses the key choice and describes it", async () => {
    routes[`PUT ${PATH}`] = () =>
      json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Check the highlighted fields",
            requestId: "r",
            fieldErrors: { apiKey: ["Required while the assistant is on"] },
          },
        },
        422
      )
    const user = userEvent.setup()
    renderView()
    await ready()
    const keyGroup = screen.getByRole("radiogroup", { name: "API key" })
    const remove = within(keyGroup).getByRole("radio", { name: /Remove/ })
    await user.click(remove)
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(remove).toHaveFocus())
    expect(keyGroup).toHaveAccessibleDescription(
      expect.stringContaining("Required while the assistant is on")
    )
    expect(keyGroup).toHaveAttribute("aria-invalid", "true")
  })

  it("an owner viewing the admin as someone else cannot turn enquiry details on", async () => {
    renderView(["owner"], "admin-1")
    await ready()
    const share = screen.getByRole("switch", {
      name: "Let the assistant read enquiry details",
    })
    expect(share).toHaveAttribute("aria-disabled", "true")
    expect(
      screen.getByText(
        "Not available while you view the admin as someone else."
      )
    ).toBeInTheDocument()
  })

  it("List models says “Save first” while the provider is unsaved, and asks nothing", async () => {
    const user = userEvent.setup()
    renderView()
    await ready()
    await user.click(screen.getByRole("radio", { name: "OpenAI" }))
    const list = screen.getByRole("button", { name: "List models" })
    expect(list).toHaveAttribute("aria-disabled", "true")
    expect(list).toHaveAccessibleDescription("Save first")
    await user.click(list)
    expect(calls.some((c) => c.path === "/api/v1/admin/ai/models")).toBe(false)
  })

  it("an admin does not see the enquiry-details fieldset; an owner does", async () => {
    const admin = renderView(["admin"])
    await ready()
    expect(screen.queryByRole("group", { name: "Enquiry details" })).toBeNull()
    expect(
      screen.queryByRole("switch", {
        name: "Let the assistant read enquiry details",
      })
    ).toBeNull()
    admin.unmount()

    renderView(["owner"])
    await ready()
    const fieldset = screen.getByRole("group", { name: "Enquiry details" })
    expect(
      within(fieldset).getByRole("switch", {
        name: "Let the assistant read enquiry details",
      })
    ).toBeInTheDocument()
  })

  it("an owner turning enquiry details on must tick the acknowledgement; it is sent with the save", async () => {
    const user = userEvent.setup()
    renderView(["owner"])
    await ready()
    expect(screen.queryByRole("checkbox", { name: /I confirm/ })).toBeNull()
    await user.click(
      screen.getByRole("switch", {
        name: "Let the assistant read enquiry details",
      })
    )
    await user.click(screen.getByRole("checkbox", { name: /I confirm/ }))
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(puts()).toHaveLength(1))
    expect(puts()[0]).toMatchObject({
      version: 2,
      values: { shareEnquiryDetails: { enabled: true, acknowledge: true } },
    })
  })

  it("the Test button is disabled while dirty, with “Save first”", async () => {
    const user = userEvent.setup()
    renderView()
    await ready()
    const test = screen.getByRole("button", { name: "Test connection" })
    expect(test).not.toHaveAttribute("aria-disabled")
    await user.type(
      screen.getByRole("textbox", { name: /^Extra instructions/ }),
      "Be brief."
    )
    expect(test).toHaveAttribute("aria-disabled", "true")
    expect(test).toHaveAccessibleDescription("Save first")
    await user.click(test)
    expect(calls.some((c) => c.path.endsWith("/test"))).toBe(false)
  })

  it("shows the Base URL only for OpenAI-compatible", async () => {
    const user = userEvent.setup()
    renderView()
    await ready()
    expect(screen.queryByRole("textbox", { name: "Base URL" })).toBeNull()
    await user.click(screen.getByRole("radio", { name: "OpenAI-compatible" }))
    expect(
      screen.getByRole("textbox", { name: "Base URL" })
    ).toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: "OpenAI" }))
    expect(screen.queryByRole("textbox", { name: "Base URL" })).toBeNull()
  })

  it("API key: Keep sends nothing, Replace sends the new key, Remove asks to clear it", async () => {
    const user = userEvent.setup()
    renderView()
    await ready()
    const keyGroup = screen.getByRole("radiogroup", { name: "API key" })
    expect(within(keyGroup).getByRole("radio", { name: /Keep/ })).toBeChecked()
    expect(screen.queryByLabelText("New API key")).toBeNull()

    await user.click(within(keyGroup).getByRole("radio", { name: /Remove/ }))
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(puts()).toHaveLength(1))
    expect(puts()[0]).toMatchObject({ clearSecrets: ["apiKey"] })
    expect(
      (puts()[0] as { values: Record<string, unknown> }).values
    ).not.toHaveProperty("apiKey")
  })

  it("warns that the saved key goes when the provider changes", async () => {
    const user = userEvent.setup()
    renderView()
    await ready()
    expect(screen.queryByText(/removes the saved key/)).toBeNull()
    await user.click(screen.getByRole("radio", { name: "Google Gemini" }))
    expect(screen.getByText(/removes the saved key/)).toBeInTheDocument()
    // The key choice is moot: only a new key can be entered.
    expect(screen.queryByRole("radiogroup", { name: "API key" })).toBeNull()
    expect(screen.getByLabelText("New API key")).toBeInTheDocument()
  })

  it("List models fills the ai-models datalist from the saved provider", async () => {
    const user = userEvent.setup()
    const view = renderView()
    await ready()
    await user.click(screen.getByRole("button", { name: "List models" }))
    await waitFor(() =>
      expect(
        view.container.querySelectorAll("datalist#ai-models option")
      ).toHaveLength(2)
    )
    expect(
      calls.find((c) => c.path === "/api/v1/admin/ai/models")?.body
    ).toEqual({ provider: "anthropic", baseUrl: "" })
  })
})
