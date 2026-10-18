import { QueryClientProvider } from "@tanstack/react-query"
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { uploadMediaFile, replaceMediaFile } = vi.hoisted(() => ({
  uploadMediaFile: vi.fn(),
  replaceMediaFile: vi.fn(),
}))
vi.mock("@/components/admin/media/upload-request", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  uploadMediaFile,
  replaceMediaFile,
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { MediaLibrary } from "@/components/admin/media/library"
import { makeQueryClient } from "@/components/admin/providers"
import {
  type AdminSession,
  AdminSessionProvider,
} from "@/components/admin/session-provider"
import type { Role } from "@/lib/auth/roles"
import { ApiError } from "@/lib/api-client"
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
  createdBy: null,
  ...extra,
})

type Call = { url: string; method: string; body?: unknown }
let calls: Call[]
let library: MediaItem[]
let deleteStatus: number
let blockedUsages: unknown[]

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

beforeEach(() => {
  calls = []
  library = [
    item(1),
    item(2, {
      mime: "application/pdf",
      originalName: "prices.pdf",
      width: null,
      height: null,
    }),
  ]
  deleteStatus = 200
  blockedUsages = []
  uploadMediaFile.mockReset()
  replaceMediaFile.mockReset()
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
      if (url.includes("/usages"))
        return json({
          items: [
            {
              entityType: "page",
              entityId: "home",
              field: "hero.backgroundImage",
              label: "Home page",
              href: "/admin/pages/home",
            },
          ],
        })
      if (id && method === "DELETE")
        return deleteStatus === 409
          ? json(
              {
                error: {
                  code: "CONFLICT",
                  message:
                    "This file is used in 1 place. Choose another file there first.",
                  current: { usages: blockedUsages },
                  requestId: "r",
                },
              },
              409
            )
          : json({ ok: true })
      if (id && method === "PATCH")
        return json({
          ...library.find((i) => i.id === id)!,
          ...(calls.at(-1)!.body as object),
          // A save stamps the row, as the API does.
          updatedAt: "2026-10-16T11:00:00.000Z",
        })
      if (id) return json(library.find((i) => i.id === id))
      const page = Number(
        new URL(url, "http://x").searchParams.get("page") ?? 1
      )
      return json({
        items: library.slice((page - 1) * 24, page * 24),
        page,
        pageSize: 24,
        total: library.length,
      })
    })
  )
})

function renderLibrary(roles: Role[] = ["editor"], userId = "u1") {
  const session: AdminSession = {
    user: {
      id: userId,
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

describe("MediaLibrary (master 6.3)", () => {
  it("lists files and filters by kind", async () => {
    const user = userEvent.setup()
    renderLibrary()
    expect(
      await screen.findByRole("button", { name: /photo-1\.png/ })
    ).toBeVisible()
    expect(screen.getByRole("button", { name: /prices\.pdf/ })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Documents" }))
    await waitFor(() => expect(calls.at(-1)!.url).toContain("kind=document"))
    expect(screen.getByRole("button", { name: "Documents" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
  })

  it("uploads chosen files with progress and opens the new file", async () => {
    const uploaded = item(3, { originalName: "new.png" })
    uploadMediaFile.mockImplementation(
      async (_file: File, opts: { onProgress?: (n: number) => void }) => {
        opts.onProgress?.(0.5)
        library = [uploaded, ...library]
        return uploaded
      }
    )
    const { container } = renderLibrary()
    await screen.findByRole("button", { name: /photo-1\.png/ })
    const input = container.querySelector<HTMLInputElement>(
      "[data-upload-input]"
    )!
    // The input is `hidden` (the "Choose files" button opens it): dispatch the change directly.
    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array([1])], "new.png", { type: "image/png" }),
        ],
      },
    })
    expect(uploadMediaFile).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole("dialog", { name: "new.png" })).toBeVisible()
  })

  it("saves alt text from the details sheet", async () => {
    const user = userEvent.setup()
    renderLibrary()
    await user.click(
      await screen.findByRole("button", { name: /photo-1\.png/ })
    )
    const sheet = await screen.findByRole("dialog", { name: "photo-1.png" })
    expect(
      await within(sheet).findByRole("link", { name: "Home page" })
    ).toHaveAttribute("href", "/admin/pages/home")
    await user.type(
      within(sheet).getByLabelText("Alternative text"),
      "Patrol car"
    )
    await user.click(
      within(sheet).getByRole("button", { name: "Save details" })
    )
    await waitFor(() =>
      expect(calls.some((c) => c.method === "PATCH")).toBe(true)
    )
    expect(calls.find((c) => c.method === "PATCH")!.body).toEqual({
      alt: "Patrol car",
      focal: null,
    })
  })

  it("explains a refused delete (409)", async () => {
    const user = userEvent.setup()
    deleteStatus = 409
    renderLibrary()
    await user.click(
      await screen.findByRole("button", { name: /photo-1\.png/ })
    )
    const sheet = await screen.findByRole("dialog", { name: "photo-1.png" })
    await user.click(within(sheet).getByRole("button", { name: "Delete" }))
    const confirm = await screen.findByRole("alertdialog", {
      name: "Delete this file?",
    })
    await user.click(within(confirm).getByRole("button", { name: "Delete" }))
    expect(await within(sheet).findByRole("alert")).toHaveTextContent(
      "This file is used in 1 place."
    )
  })

  it("viewers see no upload, save or delete controls", async () => {
    const user = userEvent.setup()
    const { container } = renderLibrary(["viewer"])
    await user.click(
      await screen.findByRole("button", { name: /photo-1\.png/ })
    )
    const sheet = await screen.findByRole("dialog", { name: "photo-1.png" })
    expect(container.querySelector("[data-upload-input]")).toBeNull()
    expect(
      within(sheet).queryByRole("button", { name: "Save details" })
    ).toBeNull()
    expect(within(sheet).queryByRole("button", { name: "Delete" })).toBeNull()
    expect(within(sheet).getByLabelText("Alternative text")).toHaveAttribute(
      "readonly"
    )
  })

  it("announces uploads politely and shows each file's error", async () => {
    let finish!: (item: MediaItem) => void
    uploadMediaFile.mockImplementation(
      (file: File, opts: { onProgress?: (n: number) => void }) => {
        if (file.name === "broken.png")
          return Promise.reject(
            new ApiError(422, {
              error: {
                code: "VALIDATION_FAILED",
                message: "This image could not be read.",
              },
            })
          )
        opts.onProgress?.(0.37)
        return new Promise<MediaItem>((resolve) => (finish = resolve))
      }
    )
    const { container } = renderLibrary()
    await screen.findByRole("button", { name: /photo-1\.png/ })
    fireEvent.change(
      container.querySelector<HTMLInputElement>("[data-upload-input]")!,
      {
        target: {
          files: [
            new File([new Uint8Array([1])], "big.png", { type: "image/png" }),
            new File([new Uint8Array([1])], "broken.png", {
              type: "image/png",
            }),
            new File([new Uint8Array([1])], "bad.gif", { type: "image/gif" }),
          ],
        },
      }
    )
    const uploads = screen.getByRole("list", { name: "Uploads" })
    const bar = within(uploads).getByRole("progressbar", {
      name: "Uploading big.png",
    })
    expect(bar).toHaveAttribute("aria-valuenow", "37")
    // A GIF never leaves the browser: the type is checked first.
    expect(uploadMediaFile).toHaveBeenCalledTimes(2)
    // The polite region speaks on start and finish, never per percent.
    const live = screen.getByRole("status", { name: "Upload progress" })
    await waitFor(() => expect(live).toHaveTextContent("Uploading 2 files…"))
    const alerts = await within(uploads).findAllByRole("alert")
    expect(alerts.map((a) => a.textContent)).toEqual([
      "broken.png: This image could not be read.",
      "bad.gif: This type of file is not supported. Upload a JPEG, PNG, WebP, AVIF, SVG or PDF file.",
    ])
    finish(item(4, { originalName: "big.png" }))
    await waitFor(() => expect(live).toHaveTextContent("big.png uploaded."))
    expect(live).not.toHaveTextContent("37")
  })

  it("sends at most three files at a time; a file without a type is sent", async () => {
    const pending: ((item: MediaItem) => void)[] = []
    uploadMediaFile.mockImplementation(
      () => new Promise<MediaItem>((resolve) => pending.push(resolve))
    )
    const { container } = renderLibrary()
    await screen.findByRole("button", { name: /photo-1\.png/ })
    fireEvent.change(
      container.querySelector<HTMLInputElement>("[data-upload-input]")!,
      {
        target: {
          files: ["a", "b", "c", "d", "e"].map(
            (n) => new File([new Uint8Array([1])], `${n}.dat`, { type: "" })
          ),
        },
      }
    )
    expect(uploadMediaFile).toHaveBeenCalledTimes(3)
    const uploads = screen.getByRole("list", { name: "Uploads" })
    expect(within(uploads).getAllByText("Waiting")).toHaveLength(2)
    pending[0]!(item(5))
    await waitFor(() => expect(uploadMediaFile).toHaveBeenCalledTimes(4))
    pending[1]!(item(6))
    await waitFor(() => expect(uploadMediaFile).toHaveBeenCalledTimes(5))
  })

  it("sends the optional alternative text with a single upload", async () => {
    const user = userEvent.setup()
    uploadMediaFile.mockResolvedValue(item(3, { originalName: "gate.png" }))
    const { container } = renderLibrary()
    await screen.findByRole("button", { name: /photo-1\.png/ })
    const zone = screen.getByRole("region", { name: "Upload files" })
    const alt = within(zone).getByLabelText(/^Alternative text/)
    await user.type(alt, "The main gate at night")
    fireEvent.change(
      container.querySelector<HTMLInputElement>("[data-upload-input]")!,
      {
        target: {
          files: [
            new File([new Uint8Array([1])], "gate.png", { type: "image/png" }),
          ],
        },
      }
    )
    expect(uploadMediaFile).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({ alt: "The main gate at night" })
    )
    expect(alt).toHaveValue("")
  })

  it("shows replace progress beside a button whose name stays put", async () => {
    const user = userEvent.setup()
    let progress!: (n: number) => void
    replaceMediaFile.mockImplementation(
      (_id: string, _f: File, o: { onProgress: (n: number) => void }) => {
        progress = o.onProgress
        return new Promise(() => undefined)
      }
    )
    renderLibrary()
    await user.click(
      await screen.findByRole("button", { name: /photo-1\.png/ })
    )
    const sheet = await screen.findByRole("dialog", { name: "photo-1.png" })
    const button = within(sheet).getByRole("button", { name: "Replace file…" })
    fireEvent.change(
      sheet.querySelector<HTMLInputElement>('input[type="file"]')!,
      {
        target: {
          files: [
            new File([new Uint8Array([1])], "new.png", { type: "image/png" }),
          ],
        },
      }
    )
    progress(0.5)
    const bar = await within(sheet).findByRole("progressbar", {
      name: "Replacing the file",
    })
    expect(bar).toHaveAttribute("aria-valuenow", "50")
    expect(button).toHaveAccessibleName("Replace file…")
    expect(button).toHaveAttribute("aria-disabled", "true")
  })

  it("lets an uploader describe their own file, nothing more", async () => {
    library = [item(1, { createdBy: "u7" }), item(2, { createdBy: "u8" })]
    const user = userEvent.setup()
    renderLibrary(["author"], "u7")
    await user.click(
      await screen.findByRole("button", { name: /photo-1\.png/ })
    )
    let sheet = await screen.findByRole("dialog", { name: "photo-1.png" })
    expect(
      within(sheet).getByLabelText("Alternative text")
    ).not.toHaveAttribute("readonly")
    expect(
      within(sheet).queryByRole("button", { name: "Replace file…" })
    ).toBeNull()
    expect(within(sheet).queryByRole("button", { name: "Delete" })).toBeNull()
    await user.type(within(sheet).getByLabelText("Alternative text"), "Mine")
    await user.click(
      within(sheet).getByRole("button", { name: "Save details" })
    )
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
        alt: "Mine",
        focal: null,
      })
    )
    // Someone else's upload stays read-only.
    await user.keyboard("{Escape}")
    await waitFor(() => expect(sheet).not.toBeInTheDocument())
    await user.click(screen.getByRole("button", { name: /photo-2\.png/ }))
    sheet = await screen.findByRole("dialog", { name: "photo-2.png" })
    expect(within(sheet).getByLabelText("Alternative text")).toHaveAttribute(
      "readonly"
    )
    expect(
      within(sheet).queryByRole("button", { name: "Save details" })
    ).toBeNull()
  })

  it("goes back to the last page when its files are gone", async () => {
    const user = userEvent.setup()
    library = Array.from({ length: 25 }, (_, n) =>
      item(n % 10, {
        id: `0190a6e0-0000-7000-8000-0000000001${String(n).padStart(2, "0")}`,
      })
    )
    renderLibrary()
    await screen.findAllByRole("button", { name: /photo-1\.png/ })
    // Someone deletes a file meanwhile: page 2 comes back empty.
    library = library.slice(0, 24)
    await user.click(screen.getByRole("button", { name: "Next page" }))
    // Page 2 answered "24 in all": the library shows page 1 again.
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes("page=2"))).toBe(true)
    )
    await waitFor(() => expect(screen.queryByText("Loading media…")).toBeNull())
    expect(await screen.findByText(/^1–24 of /)).toBeVisible()
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled()
    expect(
      (await screen.findAllByRole("button", { name: /photo-1\.png/ }))[0]
    ).toBeVisible()
    expect(screen.queryByText("No files yet")).toBeNull()
  })

  it("keeps focus on Save details after saving", async () => {
    const user = userEvent.setup()
    renderLibrary()
    await user.click(
      await screen.findByRole("button", { name: /photo-1\.png/ })
    )
    const sheet = await screen.findByRole("dialog", { name: "photo-1.png" })
    const save = within(sheet).getByRole("button", { name: "Save details" })
    expect(save).toHaveAttribute("aria-disabled", "true")
    await user.type(within(sheet).getByLabelText("Alternative text"), "Gate")
    expect(save).not.toHaveAttribute("aria-disabled")
    await user.click(save)
    await waitFor(() =>
      expect(calls.some((c) => c.method === "PATCH")).toBe(true)
    )
    await waitFor(() => expect(save).toHaveAttribute("aria-disabled", "true"))
    expect(save).toBeInTheDocument()
    expect(save).toHaveFocus()
  })

  it("lists the places that block a delete (409)", async () => {
    const user = userEvent.setup()
    deleteStatus = 409
    blockedUsages = [
      {
        entityType: "page",
        entityId: "home",
        field: "hero.backgroundImage",
        label: "Home page",
        href: "/admin/pages/home",
      },
      {
        entityType: "service",
        entityId: "s1",
        field: "image",
        label: "A service",
        href: null,
      },
    ]
    renderLibrary()
    await user.click(
      await screen.findByRole("button", { name: /photo-1\.png/ })
    )
    const sheet = await screen.findByRole("dialog", { name: "photo-1.png" })
    await user.click(within(sheet).getByRole("button", { name: "Delete" }))
    const confirm = await screen.findByRole("alertdialog", {
      name: "Delete this file?",
    })
    await user.click(within(confirm).getByRole("button", { name: "Delete" }))
    const alert = await within(sheet).findByRole("alert")
    const places = within(alert).getByRole("list", { name: "Where it is used" })
    expect(
      within(places).getByRole("link", { name: "Home page" })
    ).toHaveAttribute("href", "/admin/pages/home")
    expect(places).toHaveTextContent("A service")
  })

  it("switches to the list view", async () => {
    const user = userEvent.setup()
    renderLibrary()
    await screen.findByRole("button", { name: /photo-1\.png/ })
    await user.click(screen.getByRole("button", { name: "List" }))
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    const table = screen.getByRole("table", { name: "Files" })
    expect(
      within(table).getByRole("button", { name: "prices.pdf" })
    ).toBeVisible()
    expect(within(table).getByText("PDF document")).toBeVisible()
  })

  it("explains an empty library and a search with no hits", async () => {
    const user = userEvent.setup()
    library = []
    renderLibrary()
    expect(await screen.findByText("No files yet")).toBeVisible()
    await user.type(
      screen.getByRole("searchbox", { name: "Search media" }),
      "zebra"
    )
    expect(await screen.findByText("Nothing matches “zebra”.")).toBeVisible()
  })

  it("asks before closing the details with unsaved alt text (final review I2)", async () => {
    const user = userEvent.setup()
    renderLibrary()
    await user.click(
      await screen.findByRole("button", { name: /photo-1\.png/ })
    )
    const sheet = await screen.findByRole("dialog", { name: "photo-1.png" })
    await user.type(within(sheet).getByLabelText("Alternative text"), "Car")
    await user.keyboard("{Escape}")
    const confirm = await screen.findByRole("alertdialog", {
      name: "Discard your changes to this file?",
    })
    await user.click(
      within(confirm).getByRole("button", { name: "Keep editing" })
    )
    expect(within(sheet).getByLabelText("Alternative text")).toHaveValue("Car")
    await user.keyboard("{Escape}")
    await user.click(
      within(
        await screen.findByRole("alertdialog", {
          name: "Discard your changes to this file?",
        })
      ).getByRole("button", { name: "Discard changes" })
    )
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "photo-1.png" })).toBeNull()
    )
  })

  it("keeps search and kind in the URL (final review I8)", async () => {
    const user = userEvent.setup()
    renderLibrary()
    await screen.findByRole("button", { name: /photo-1\.png/ })
    await user.click(screen.getByRole("button", { name: "Documents" }))
    await waitFor(() => expect(window.location.search).toBe("?kind=document"))
  })
})
