import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/appearance",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))
const { toastMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn() },
}))
vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("sonner")>()),
  toast: toastMock,
}))

import { AppearanceView } from "@/components/admin/appearance/appearance-view"
import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import { AdminThemeProvider } from "@/components/admin/theme-provider"
import type { Role } from "@/lib/auth/roles"
import type { ThemeDto } from "@/lib/schemas/api/theme"
import { checkTheme } from "@/lib/theme/checks"
import {
  DEFAULT_THEME,
  ThemeConfig,
  type ThemeConfigValue,
} from "@/lib/theme/schema"

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

function dto(draft: ThemeConfigValue, extra: Partial<ThemeDto> = {}): ThemeDto {
  return {
    draft: copy(draft),
    published: copy(DEFAULT_THEME),
    version: 1,
    updatedAt: "2026-10-19T09:00:00.000Z",
    issues: checkTheme(draft),
    hasDraft: JSON.stringify(draft) !== JSON.stringify(DEFAULT_THEME),
    ...extra,
  }
}

type Call = { method: string; path: string; body: unknown }
let calls: Call[]
let respond: (call: Call) => Response | undefined

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

function serve(initial: ThemeDto) {
  let current = initial
  respond = ({ method, path, body }) => {
    if (path === "/api/v1/admin/appearance" && method === "GET")
      return json(current)
    if (path === "/api/v1/admin/appearance/draft" && method === "PUT") {
      const { draft, version } = body as {
        draft: ThemeConfigValue
        version: number
      }
      current = dto(ThemeConfig.parse(draft), { version: version + 1 })
      return json(current)
    }
    if (path === "/api/v1/admin/appearance/publish" && method === "POST") {
      current = {
        ...current,
        published: current.draft,
        hasDraft: false,
        version: current.version + 1,
      }
      return json(current)
    }
    if (path.startsWith("/api/v1/admin/revisions/")) return json({ items: [] })
    return undefined
  }
}

beforeEach(() => {
  calls = []
  toastMock.error.mockClear()
  toastMock.success.mockClear()
  localStorage.clear()
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(
        input instanceof Request ? input.url : String(input),
        "http://localhost"
      )
      const method = (
        init?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase()
      const raw =
        init?.body ??
        (input instanceof Request && method !== "GET"
          ? await input.clone().text()
          : undefined)
      const call = {
        method,
        path: url.pathname,
        body: typeof raw === "string" && raw ? JSON.parse(raw) : undefined,
      }
      calls.push(call)
      return (
        respond(call) ??
        json({ error: { code: "FORBIDDEN", message: "Forbidden" } }, 403)
      )
    })
  )
})

afterEach(() => {
  document.documentElement.removeAttribute("style")
  document.documentElement.className = ""
  localStorage.clear()
})

function renderAs(roles: Role[], autosaveDelay = 10) {
  return render(
    <AdminThemeProvider>
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
        <AppearanceView autosaveDelay={autosaveDelay} />
      </AdminShell>
    </AdminThemeProvider>
  )
}

describe("Appearance screen (C5)", () => {
  it("owner: an admin preset recolours live, autosaves, then publishes", async () => {
    serve(dto(DEFAULT_THEME))
    const user = userEvent.setup()
    renderAs(["owner"])
    await screen.findByRole("heading", { level: 1, name: "Appearance" })
    const status = screen.getByRole("status", { name: "Save status" })
    expect(status).toHaveTextContent("No draft changes")
    const publish = screen.getByRole("button", { name: "Publish" })
    expect(publish).toBeDisabled()

    await user.click(screen.getByRole("tab", { name: "Admin" }))
    await user.click(screen.getByRole("button", { name: /Evergreen/ }))
    const html = document.documentElement
    await waitFor(() =>
      expect(html.style.getPropertyValue("--primary")).toMatch(/^oklch\(/)
    )
    await waitFor(() => expect(status).toHaveTextContent("Draft saved"))
    const put = calls.find((c) => c.method === "PUT")!
    expect(put.body).toMatchObject({
      version: 1,
      draft: { admin: { preset: "evergreen" } },
    })

    expect(publish).toBeEnabled()
    await user.click(publish)
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Publish" }))
    await waitFor(() =>
      expect(calls.find((c) => c.path.endsWith("/publish"))?.body).toEqual({
        version: 2,
      })
    )
    await waitFor(() => expect(publish).toBeDisabled())
  })

  it("leaving the page hands the admin back to the published theme", async () => {
    serve(dto(ThemeConfig.parse({ admin: { preset: "ocean" } })))
    const { unmount } = renderAs(["owner"])
    const html = document.documentElement
    await waitFor(() =>
      expect(html.style.getPropertyValue("--primary")).not.toBe("")
    )
    act(() => unmount())
    expect(html.style.getPropertyValue("--primary")).toBe("")
  })

  it("blocks publishing while a pair fails, with the banner", async () => {
    const failing = ThemeConfig.parse({
      site: { tokens: { "brand-ink": "#eeeeee" } },
    })
    serve(dto(failing))
    renderAs(["owner"])
    const banner = await screen.findByText(
      "Publishing is blocked until every pair passes."
    )
    expect(screen.getByRole("status", { name: "Publish checks" })).toContain(
      banner
    )
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled()
  })

  it("keeps the publish-checks live region mounted while empty (review C5 m5)", async () => {
    serve(dto(DEFAULT_THEME))
    renderAs(["owner"])
    await screen.findByRole("heading", { level: 1, name: "Appearance" })
    // A live region inserted already filled is often not announced.
    expect(
      screen.getByRole("status", { name: "Publish checks" })
    ).toBeEmptyDOMElement()
  })

  /** Every draft save answers 409 with their version. */
  function serveConflict() {
    const theirs = dto(ThemeConfig.parse({ admin: { preset: "plum" } }), {
      version: 5,
    })
    serve(dto(DEFAULT_THEME))
    const base = respond
    respond = (call) =>
      call.method === "PUT"
        ? json(
            {
              error: {
                code: "CONFLICT",
                message: "Changed by someone else",
                current: theirs,
              },
            },
            409
          )
        : base(call)
  }

  it("an action whose flush hits a 409 shows only the conflict dialog (review C5 m2)", async () => {
    serveConflict()
    const user = userEvent.setup()
    // No autosave before the action: its own flush meets the 409.
    renderAs(["owner"], 60_000)
    await user.click(await screen.findByRole("tab", { name: "Admin" }))
    await user.click(screen.getByRole("button", { name: /Graphite/ }))
    await user.click(screen.getByRole("button", { name: "Discard draft" }))
    const confirm = await screen.findByRole("alertdialog")
    await user.click(within(confirm).getByRole("button", { name: /Discard/ }))
    await screen.findByRole("alertdialog", {
      name: "Someone else changed this",
    })
    expect(calls.some((c) => c.path.endsWith("/discard"))).toBe(false)
    // Let the rejected action settle: it must not add a toast.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
    expect(toastMock.error).not.toHaveBeenCalled()
  })

  it("Preview on site does not open a stale preview when the save fails (review C5 m3)", async () => {
    serveConflict()
    const tab = {
      opener: {} as unknown,
      close: vi.fn(),
      location: { href: "" },
    }
    const open = vi.spyOn(window, "open").mockReturnValue(tab as never)
    try {
      const user = userEvent.setup()
      renderAs(["owner"], 60_000)
      await user.click(await screen.findByRole("tab", { name: "Admin" }))
      await user.click(screen.getByRole("button", { name: /Graphite/ }))
      await user.click(screen.getByRole("button", { name: "Preview on site" }))
      await screen.findByRole("alertdialog", {
        name: "Someone else changed this",
      })
      await waitFor(() => expect(tab.close).toHaveBeenCalled())
      expect(tab.location.href).toBe("")
      expect(open).toHaveBeenCalledTimes(1)
      // The conflict dialog is the message.
      expect(toastMock.error).not.toHaveBeenCalled()
    } finally {
      open.mockRestore()
    }
  })

  it("shows the server's reasons when publish is refused (422, re-review n3)", async () => {
    serve(dto(ThemeConfig.parse({ admin: { radius: 0.5 } })))
    const base = respond
    respond = (call) =>
      call.path.endsWith("/publish")
        ? json(
            {
              error: {
                code: "VALIDATION_FAILED",
                message: "Fix the contrast issues before publishing",
                fieldErrors: { draft: ["Stored theme is damaged"] },
              },
            },
            422
          )
        : base(call)
    const user = userEvent.setup()
    renderAs(["owner"])
    await user.click(await screen.findByRole("button", { name: "Publish" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Publish" }))
    expect(
      await screen.findByText("Publishing is blocked until every pair passes.")
    ).toBeInTheDocument()
    expect(screen.getByText("Stored theme is damaged")).toBeInTheDocument()
  })

  it("opens the conflict dialog when an autosave gets 409", async () => {
    const theirs = dto(ThemeConfig.parse({ admin: { preset: "plum" } }), {
      version: 5,
    })
    serve(dto(DEFAULT_THEME))
    const base = respond
    respond = (call) =>
      call.method === "PUT"
        ? json(
            {
              error: {
                code: "CONFLICT",
                message: "Changed by someone else",
                current: theirs,
              },
            },
            409
          )
        : base(call)
    const user = userEvent.setup()
    renderAs(["owner"])
    await user.click(await screen.findByRole("tab", { name: "Admin" }))
    await user.click(screen.getByRole("button", { name: /Graphite/ }))
    const dialog = await screen.findByRole("alertdialog", {
      name: "Someone else changed this",
    })
    // The modal hides the page from the a11y tree while it is open.
    expect(
      screen.getByRole("status", { name: "Save status", hidden: true })
    ).toHaveTextContent("Changed by someone else")
    await user.click(
      within(dialog).getByRole("button", { name: "Reload their version" })
    )
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Plum/ })).toHaveAttribute(
        "aria-pressed",
        "true"
      )
    )
  })

  it("marketer sees it read-only: no actions, inputs disabled, no brand images", async () => {
    serve(dto(DEFAULT_THEME))
    const user = userEvent.setup()
    renderAs(["marketer"])
    await screen.findByRole("heading", { level: 1, name: "Appearance" })
    for (const name of ["Publish", "Discard draft", "Reset to preset…"])
      expect(screen.queryByRole("button", { name })).toBeNull()
    expect(screen.getByRole("button", { name: /Evergreen/ })).toBeDisabled()
    expect(screen.getByRole("textbox", { name: "Brand" })).toBeDisabled()
    expect(screen.queryByRole("button", { name: /Fix/ })).toBeNull()
    expect(screen.queryByRole("heading", { name: "Brand images" })).toBeNull()
    await user.click(screen.getByRole("tab", { name: "Admin" }))
    expect(screen.getByRole("textbox", { name: "Primary" })).toBeDisabled()
    expect(screen.getByRole("slider", { name: "Corner radius" })).toBeDisabled()
    expect(calls.some((c) => c.method !== "GET")).toBe(false)
  })

  it("the admin preview names the resolved mode", async () => {
    localStorage.setItem("sp-admin-theme", "dark")
    serve(dto(DEFAULT_THEME))
    const user = userEvent.setup()
    renderAs(["owner"])
    await user.click(await screen.findByRole("tab", { name: "Admin" }))
    await waitFor(() =>
      expect(
        screen.getByRole("group", { name: "Admin preview" })
      ).toHaveAttribute("data-mode", "dark")
    )
  })
})
