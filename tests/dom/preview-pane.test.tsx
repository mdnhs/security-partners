import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/settings/contact",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

import { PreviewPane } from "@/components/admin/editor/preview-pane"
import { makeQueryClient } from "@/components/admin/providers"
import { SettingsEditor } from "@/components/admin/settings/settings-editor"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import { useMediaQuery } from "@/hooks/use-media-query"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { settingsFixture } from "@/server/db/seed/fixtures/settings"

const SRC = "/api/v1/admin/preview?entity=page&id=home"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("PreviewPane (JW live preview)", () => {
  it("frames the draft preview with a title and a new-tab link", () => {
    render(<PreviewPane src={SRC} refreshKey={1} />)
    const region = screen.getByRole("region", { name: "Live preview" })
    const frame = within(region).getByTitle("Page preview")
    expect(frame.tagName).toBe("IFRAME")
    expect(frame).toHaveAttribute("src", SRC)
    expect(frame).toHaveAttribute("referrerpolicy", "same-origin")
    const link = within(region).getByRole("link", {
      name: "Open the preview in a new tab",
    })
    expect(link).toHaveAttribute("href", SRC)
    // 44 px targets on touch (WCAG 2.5.8 / JW): device toggles and the link.
    expect(link).toHaveClass("pointer-coarse:size-11")
    const group = within(region).getByRole("group", { name: "Preview size" })
    expect(group.className).toContain(
      "[&_[data-slot=toggle-group-item]]:pointer-coarse:h-11"
    )
    expect(group.className).toContain(
      "[&_[data-slot=toggle-group-item]]:pointer-coarse:min-w-11"
    )
  })

  it("returns the frame to the record's preview URL on refresh, wherever it navigated", () => {
    const { rerender } = render(<PreviewPane src={SRC} refreshKey={1} />)
    const frame = screen.getByTitle("Page preview") as HTMLIFrameElement
    fireEvent.load(frame)
    // The user clicked a link inside the frame (e.g. "Exit preview").
    frame.src = "/terms"
    expect(frame.getAttribute("src")).toBe("/terms")
    rerender(<PreviewPane src={SRC} refreshKey={2} />)
    expect(frame.getAttribute("src")).toBe(SRC)
  })

  it("gives up after 10 s and offers the new tab instead", () => {
    vi.useFakeTimers()
    render(<PreviewPane src={SRC} refreshKey={1} />)
    expect(screen.getByLabelText("Refreshing")).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(screen.queryByLabelText("Refreshing")).toBeNull()
    const notice = screen.getByRole("status", { name: "Preview didn't load" })
    expect(
      within(notice).getByRole("link", { name: "Open it in a new tab" })
    ).toHaveAttribute("href", SRC)
    // A late load clears the notice.
    fireEvent.load(screen.getByTitle("Page preview"))
    expect(
      screen.queryByRole("status", { name: "Preview didn't load" })
    ).toBeNull()
  })

  it("switches the frame width by device", async () => {
    const user = userEvent.setup()
    render(<PreviewPane src={SRC} refreshKey={1} />)
    const frame = screen.getByTitle("Page preview")
    expect(frame.style.width).toBe("1440px")
    await user.click(screen.getByRole("button", { name: "Phone" }))
    expect(frame.style.width).toBe("390px")
    await user.click(screen.getByRole("button", { name: "Tablet" }))
    expect(frame.style.width).toBe("834px")
  })

  it("reloads the frame when the saved version changes, not on mount", () => {
    const { rerender } = render(<PreviewPane src={SRC} refreshKey={1} />)
    const frame = screen.getByTitle("Page preview") as HTMLIFrameElement
    fireEvent.load(frame)
    const setSrc = vi.fn()
    Object.defineProperty(frame, "src", {
      configurable: true,
      get: () => SRC,
      set: setSrc,
    })
    rerender(<PreviewPane src={SRC} refreshKey={1} />)
    expect(setSrc).not.toHaveBeenCalled()
    expect(screen.queryByLabelText("Refreshing")).toBeNull()
    rerender(<PreviewPane src={SRC} refreshKey={2} />)
    expect(setSrc).toHaveBeenCalledTimes(1)
    expect(setSrc).toHaveBeenCalledWith(SRC)
    expect(screen.getByLabelText("Refreshing")).toBeInTheDocument()
  })
})

describe("useMediaQuery", () => {
  it("follows matchMedia (false on the server snapshot)", () => {
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          matches: query === "(min-width: 1536px)",
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList
    )
    function Probe() {
      return <p>{useMediaQuery("(min-width: 1536px)") ? "wide" : "narrow"}</p>
    }
    render(<Probe />)
    expect(screen.getByText("wide")).toBeInTheDocument()
  })
})

// The editor's "Live preview" toggle (ruling D9): off by default, remembered
// per user in localStorage, and the pane only exists when it is on and the
// viewport is at least 1536 px wide.
describe("live preview toggle in the editor", () => {
  const settings = settingsFixture(fixtureMediaLookup)
  const contact = {
    key: "contact",
    label: "Contact details",
    description: "",
    group: "Site",
    canEdit: true,
    draft: settings.contact,
    published: settings.contact,
    version: 3,
    status: "published",
    dirty: false,
    publishedAt: null,
    updatedAt: "2026-10-16T09:00:00.000Z",
    updatedBy: null,
  }
  const originalWidth = window.innerWidth

  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(contact), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
      )
    )
  })
  afterEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: originalWidth,
    })
  })

  function renderEditor(width: number) {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width,
    })
    render(
      <AdminShell
        queryClient={makeQueryClient()}
        session={{
          user: {
            id: "user-7",
            name: "U",
            email: "u@x.test",
            title: null,
            twoFactorEnabled: true,
          },
          roles: ["admin"],
          impersonatedBy: null,
        }}
      >
        <SettingsEditor settingsKey="contact" />
      </AdminShell>
    )
  }

  it("is off by default, mounts the pane when turned on, and remembers it per user", async () => {
    const user = userEvent.setup()
    renderEditor(1600)
    await screen.findByRole("heading", { level: 1, name: "Contact details" })
    const toggle = screen.getByRole("switch", { name: "Live preview" })
    expect(toggle).toHaveAttribute("aria-checked", "false")
    expect(screen.queryByRole("region", { name: "Live preview" })).toBeNull()
    expect(document.querySelector("iframe")).toBeNull()

    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-checked", "true")
    const pane = await screen.findByRole("region", { name: "Live preview" })
    expect(within(pane).getByTitle("Page preview")).toHaveAttribute(
      "src",
      "/api/v1/admin/preview?entity=settings&id=contact"
    )
    expect(localStorage.getItem("sp-admin-live-preview:user-7")).toBe("on")

    await user.click(toggle)
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Live preview" })).toBeNull()
    )
    expect(localStorage.getItem("sp-admin-live-preview:user-7")).toBe("off")
  })

  it("keeps the choice for the session when storage is unavailable", async () => {
    const user = userEvent.setup()
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError")
      })
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("SecurityError")
      })
    try {
      renderEditor(1600)
      await screen.findByRole("heading", { level: 1, name: "Contact details" })
      const toggle = screen.getByRole("switch", { name: "Live preview" })
      await user.click(toggle)
      expect(toggle).toHaveAttribute("aria-checked", "true")
      expect(
        await screen.findByRole("region", { name: "Live preview" })
      ).toBeInTheDocument()
    } finally {
      setItem.mockRestore()
      getItem.mockRestore()
    }
  })

  it("starts on when the user turned it on before", async () => {
    localStorage.setItem("sp-admin-live-preview:user-7", "on")
    renderEditor(1600)
    await screen.findByRole("heading", { level: 1, name: "Contact details" })
    expect(
      screen.getByRole("switch", { name: "Live preview" })
    ).toHaveAttribute("aria-checked", "true")
    expect(
      await screen.findByRole("region", { name: "Live preview" })
    ).toBeInTheDocument()
  })

  it("has neither toggle nor pane below 1536 px, even when on", async () => {
    localStorage.setItem("sp-admin-live-preview:user-7", "on")
    renderEditor(1440)
    await screen.findByRole("heading", { level: 1, name: "Contact details" })
    expect(screen.queryByRole("switch", { name: "Live preview" })).toBeNull()
    expect(screen.queryByRole("region", { name: "Live preview" })).toBeNull()
    expect(document.querySelector("iframe")).toBeNull()
    // The Preview link to a new tab remains the way to preview.
    expect(screen.getByRole("link", { name: "Preview" })).toHaveAttribute(
      "target",
      "_blank"
    )
  })
})
