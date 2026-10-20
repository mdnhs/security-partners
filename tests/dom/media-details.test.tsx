import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useSearchParams: () => new URLSearchParams(window.location.search),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { MediaLibrary } from "@/components/admin/media/library"
import { makeQueryClient } from "@/components/admin/providers"
import {
  type AdminSession,
  AdminSessionProvider,
} from "@/components/admin/session-provider"
import type { Role } from "@/lib/auth/roles"
import type { MediaItem } from "@/lib/schemas/api/media"

const item = (n: number, extra: Partial<MediaItem> = {}): MediaItem => ({
  id: `0190a6e0-0000-7000-8000-00000000000${n}`,
  url: `/api/v1/media/file/2026/10/file-${n}.png`,
  alt: "",
  mime: "image/png",
  width: 64,
  height: 48,
  size: 2048,
  createdAt: "2026-10-16T10:00:00.000Z",
  updatedAt: "2026-10-16T10:00:00.000Z",
  originalName: `photo-${n}.png`,
  driver: "disk",
  focalX: null,
  focalY: null,
  isDecorative: false,
  caption: "",
  createdBy: null,
  ...extra,
})

type Call = { url: string; method: string; body?: unknown }
let calls: Call[]
let library: MediaItem[]

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

beforeEach(() => {
  calls = []
  library = [
    item(1, { alt: "Patrol car" }),
    item(2),
    item(3, {
      mime: "application/pdf",
      originalName: "prices.pdf",
      width: null,
      height: null,
    }),
  ]
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      calls.push({
        url,
        method,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      })
      const id = url.match(/media\/([0-9a-f-]{36})/)?.[1]
      if (url.includes("/usages")) return json({ items: [] })
      if (id && method === "PATCH")
        return json({
          ...library.find((i) => i.id === id)!,
          ...(calls.at(-1)!.body as object),
          updatedAt: "2026-10-16T11:00:00.000Z",
        })
      if (id) {
        const found = library.find((i) => i.id === id)
        return found
          ? json(found)
          : json(
              { error: { code: "NOT_FOUND", message: "Media not found." } },
              404
            )
      }
      const params = new URL(url, "http://x").searchParams
      const kind = params.get("kind")
      const items = library
        .filter(
          (i) => !kind || i.mime.startsWith("image/") === (kind === "image")
        )
        .filter(
          (i) =>
            params.get("missingAlt") !== "true" ||
            (i.mime.startsWith("image/") && !i.alt && !i.isDecorative)
        )
      return json({ items, page: 1, pageSize: 24, total: items.length })
    })
  )
})

function renderLibrary(roles: Role[] = ["editor"]) {
  const session: AdminSession = {
    user: {
      id: "u1",
      name: "Edith Editor",
      email: "e@example.test",
      title: null,
      twoFactorEnabled: false,
    },
    roles,
    impersonatedBy: null,
  }
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <AdminSessionProvider value={session}>
        <MediaLibrary />
      </AdminSessionProvider>
    </QueryClientProvider>
  )
}

describe("Media details: decorative flag, caption, missing alt text (D1.1)", () => {
  it("?open=<id> opens that file's details sheet", async () => {
    window.history.replaceState(null, "", `/?open=${item(2).id}`)
    renderLibrary()
    expect(
      await screen.findByRole("dialog", { name: "photo-2.png" })
    ).toBeVisible()
  })

  it("saves the decorative flag and caption; the alt text is kept and becomes optional", async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, "", `/?open=${item(1).id}`)
    renderLibrary()
    const sheet = await screen.findByRole("dialog", { name: "photo-1.png" })
    const alt = within(sheet).getByRole("textbox", {
      name: /^Alternative text/,
    })
    expect(alt).toHaveValue("Patrol car")
    expect(within(sheet).getByText("10/500")).toBeVisible()
    expect(alt).not.toHaveAccessibleName(/optional/)

    const decorative = within(sheet).getByRole("checkbox", {
      name: "Decorative image (no alt text needed)",
    })
    expect(decorative).not.toBeChecked()
    await user.click(decorative)
    expect(decorative).toBeChecked()
    // Still shown, still holding the text, now marked optional.
    expect(alt).toBeVisible()
    expect(alt).toHaveValue("Patrol car")
    expect(alt).toHaveAccessibleName(/Alternative text.*optional/)

    const caption = within(sheet).getByRole("textbox", { name: /^Caption/ })
    await user.type(caption, "Night shift")
    expect(within(sheet).getByText("11/300")).toBeVisible()
    await user.click(
      within(sheet).getByRole("button", { name: "Save details" })
    )
    await waitFor(() =>
      expect(calls.some((c) => c.method === "PATCH")).toBe(true)
    )
    expect(calls.find((c) => c.method === "PATCH")!.body).toEqual({
      alt: "Patrol car",
      isDecorative: true,
      caption: "Night shift",
      focal: null,
    })
  })

  it("documents have a caption but no decorative checkbox", async () => {
    window.history.replaceState(null, "", `/?open=${item(3).id}`)
    renderLibrary()
    const sheet = await screen.findByRole("dialog", { name: "prices.pdf" })
    expect(within(sheet).queryByRole("checkbox")).toBeNull()
    expect(
      within(sheet).getByRole("textbox", { name: /^Caption/ })
    ).toBeVisible()
  })

  it("viewers cannot change the decorative flag or caption", async () => {
    window.history.replaceState(null, "", `/?open=${item(1).id}`)
    renderLibrary(["viewer"])
    const sheet = await screen.findByRole("dialog", { name: "photo-1.png" })
    expect(within(sheet).getByRole("checkbox")).toHaveAttribute(
      "aria-disabled",
      "true"
    )
    expect(
      within(sheet).getByRole("textbox", { name: /^Caption/ })
    ).toHaveAttribute("readonly")
  })

  it("the Missing alt text chip filters the list and is kept in the URL", async () => {
    const user = userEvent.setup()
    renderLibrary()
    await screen.findByRole("button", { name: /photo-1\.png/ })
    const chip = screen.getByRole("button", { name: "Missing alt text" })
    expect(chip).toHaveAttribute("aria-pressed", "false")
    await user.click(chip)
    expect(chip).toHaveAttribute("aria-pressed", "true")
    await waitFor(() => expect(calls.at(-1)!.url).toContain("missingAlt=true"))
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /photo-1\.png/ })).toBeNull()
    )
    expect(screen.getByRole("button", { name: /photo-2\.png/ })).toBeVisible()
    expect(screen.queryByRole("button", { name: /prices\.pdf/ })).toBeNull()
    expect(window.location.search).toContain("missingAlt=true")
  })

  it("?missingAlt=true starts filtered", async () => {
    window.history.replaceState(null, "", "/?missingAlt=true")
    renderLibrary()
    expect(
      await screen.findByRole("button", { name: /photo-2\.png/ })
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Missing alt text" })
    ).toHaveAttribute("aria-pressed", "true")
    expect(calls[0].url).toContain("missingAlt=true")
  })
  it("?open must be a file id: a path is ignored, never fetched and dropped from the URL (review I1)", async () => {
    for (const payload of [
      "../../admin/users",
      "..%2F..%2Fusers%2Fx",
      "x?role=admin",
    ]) {
      calls = []
      window.history.replaceState(
        null,
        "",
        `/?open=${encodeURIComponent(payload)}`
      )
      const { unmount } = renderLibrary()
      await screen.findByRole("button", { name: /photo-1\.png/ })
      expect(screen.queryByRole("dialog")).toBeNull()
      // Only the list request; nothing outside /media?… was asked for.
      expect(calls.length).toBeGreaterThan(0)
      for (const c of calls) {
        expect(c.url).toMatch(/\/api\/v1\/admin\/media\?/)
        expect(c.url).not.toContain("..")
        expect(c.url).not.toContain("users")
      }
      await waitFor(() =>
        expect(new URLSearchParams(window.location.search).has("open")).toBe(
          false
        )
      )
      unmount()
    }
  })

  it("?open=<unknown id> shows File not found", async () => {
    window.history.replaceState(
      null,
      "",
      "/?open=0190a6e0-0000-7000-8000-0000000000ff"
    )
    renderLibrary()
    expect(
      await screen.findByRole("dialog", { name: "File not found" })
    ).toBeVisible()
  })

  it("closing a sheet opened from ?open= puts focus on the search, not <body> (review M2)", async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, "", `/?open=${item(2).id}`)
    renderLibrary()
    await screen.findByRole("dialog", { name: "photo-2.png" })
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    await waitFor(() =>
      expect(
        screen.getByRole("searchbox", { name: "Search media" })
      ).toHaveFocus()
    )
  })

  it("documents + Missing alt text explains the empty list (review M4)", async () => {
    window.history.replaceState(null, "", "/?kind=document&missingAlt=true")
    renderLibrary()
    expect(
      await screen.findByText(
        "Documents don't need alt text. Turn off Missing alt text to see them."
      )
    ).toBeVisible()
  })
})
