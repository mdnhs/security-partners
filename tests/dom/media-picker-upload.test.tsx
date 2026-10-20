import { QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { uploadMediaFile } = vi.hoisted(() => ({ uploadMediaFile: vi.fn() }))
vi.mock("@/components/admin/media/upload-request", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  uploadMediaFile,
}))

import { MediaPickerDialog } from "@/components/admin/media/picker-dialog"
import { makeQueryClient } from "@/components/admin/providers"
import {
  type AdminSession,
  AdminSessionProvider,
} from "@/components/admin/session-provider"
import type { Role } from "@/lib/auth/roles"
import { ApiError } from "@/lib/api-client"
import type { MediaItem } from "@/lib/schemas/api/media"

const uploaded: MediaItem = {
  id: "0190a6e0-0000-7000-8000-000000000009",
  url: "/api/v1/media/file/2026/10/new.png",
  alt: "",
  mime: "image/png",
  width: 10,
  height: 10,
  size: 100,
  createdAt: "2026-10-16T10:00:00.000Z",
  updatedAt: "2026-10-16T10:00:00.000Z",
  originalName: "new-hero.png",
  driver: "disk",
  focalX: null,
  focalY: null,
  isDecorative: false,
  caption: "",
  createdBy: null,
}

beforeEach(() => {
  uploadMediaFile.mockReset()
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            items: [uploaded],
            page: 1,
            pageSize: 24,
            total: 1,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
    )
  )
})

function renderPicker(roles: Role[] | null, onSelect = vi.fn()) {
  const picker = (
    <MediaPickerDialog
      open
      onOpenChange={() => undefined}
      onSelect={onSelect}
      title="Choose: Background image"
    />
  )
  const session: AdminSession | null = roles
    ? {
        user: {
          id: "u1",
          name: "E",
          email: "e@example.test",
          title: null,
          twoFactorEnabled: false,
        },
        roles,
        impersonatedBy: null,
      }
    : null
  render(
    <QueryClientProvider client={makeQueryClient()}>
      {session ? (
        <AdminSessionProvider value={session}>{picker}</AdminSessionProvider>
      ) : (
        picker
      )}
    </QueryClientProvider>
  )
  return onSelect
}

describe("MediaPickerDialog upload (master 6.3)", () => {
  it("uploads an image and selects it", async () => {
    uploadMediaFile.mockImplementation(
      async (_f: File, o: { onProgress?: (n: number) => void }) => {
        o.onProgress?.(0.4)
        return uploaded
      }
    )
    const onSelect = renderPicker(["author"])
    expect(
      await screen.findByRole("button", { name: "Upload new image" })
    ).toBeVisible()
    const input = document.querySelector<HTMLInputElement>(
      "[data-upload-input]"
    )!
    expect(input.accept).toBe(
      "image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
    )
    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array([1])], "new-hero.png", {
            type: "image/png",
          }),
        ],
      },
    })
    const use = screen.getByRole("button", { name: "Use this image" })
    await waitFor(() => expect(use).toBeEnabled())
    fireEvent.click(use)
    expect(onSelect).toHaveBeenCalledWith(uploaded)
  })

  it("shows the server's message when an upload fails", async () => {
    uploadMediaFile.mockRejectedValue(new Error("Network error"))
    renderPicker(["editor"])
    const input =
      (await screen.findByRole("button", { name: "Upload new image" })) &&
      document.querySelector<HTMLInputElement>("[data-upload-input]")!
    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array([1])], "x.png", { type: "image/png" }),
        ],
      },
    })
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong"
    )
  })

  it("no upload without media:create or outside the admin shell", async () => {
    renderPicker(["intake"])
    await screen.findByRole("dialog")
    expect(
      screen.queryByRole("button", { name: "Upload new image" })
    ).toBeNull()
  })

  it("renders without a session (SchemaForm tests)", async () => {
    renderPicker(null)
    expect(await screen.findByRole("dialog")).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Upload new image" })
    ).toBeNull()
  })

  it("shows progress without announcing every percent, then selects the image", async () => {
    let finish!: (item: MediaItem) => void
    uploadMediaFile.mockImplementation(
      (_f: File, o: { onProgress?: (n: number) => void }) => {
        o.onProgress?.(0.4)
        return new Promise<MediaItem>((resolve) => (finish = resolve))
      }
    )
    renderPicker(["editor"])
    const button = await screen.findByRole("button", {
      name: "Upload new image",
    })
    button.focus()
    fireEvent.change(
      document.querySelector<HTMLInputElement>("[data-upload-input]")!,
      {
        target: {
          files: [
            new File([new Uint8Array([1])], "new-hero.png", {
              type: "image/png",
            }),
          ],
        },
      }
    )
    const bar = await screen.findByRole("progressbar", {
      name: "Uploading new-hero.png",
    })
    expect(bar).toHaveAttribute("aria-valuenow", "40")
    expect(bar).toHaveTextContent("Uploading new-hero.png… 40%")
    const live = screen.getByRole("status", { name: "Upload progress" })
    await waitFor(() =>
      expect(live).toHaveTextContent("Uploading new-hero.png…")
    )
    expect(live).not.toHaveTextContent("40")
    // Unavailable while uploading, but focus stays on it (WCAG 2.4.3).
    expect(button).toHaveAttribute("aria-disabled", "true")
    expect(button).toHaveFocus()
    finish(uploaded)
    await waitFor(() =>
      expect(live).toHaveTextContent("new-hero.png uploaded and selected.")
    )
    expect(
      screen.getByRole("button", { name: /new-hero\.png/, pressed: true })
    ).toBeVisible()
    expect(button).not.toHaveAttribute("aria-disabled")
    expect(button).toHaveFocus()
  })

  it("shows the server's 422 message", async () => {
    uploadMediaFile.mockRejectedValue(
      new ApiError(422, {
        error: {
          code: "VALIDATION_FAILED",
          message: "Upload a JPEG, PNG, WebP, AVIF, SVG or PDF file",
        },
      })
    )
    renderPicker(["marketer"])
    await screen.findByRole("button", { name: "Upload new image" })
    fireEvent.change(
      document.querySelector<HTMLInputElement>("[data-upload-input]")!,
      {
        target: {
          files: [
            new File([new Uint8Array([1])], "scan.png", {
              type: "image/png",
            }),
          ],
        },
      }
    )
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "scan.png: Upload a JPEG, PNG, WebP, AVIF, SVG or PDF file"
    )
  })

  const choose = (name: string, type: string) =>
    fireEvent.change(
      document.querySelector<HTMLInputElement>("[data-upload-input]")!,
      { target: { files: [new File([new Uint8Array([1])], name, { type })] } }
    )

  it("refuses a file that is not an image before sending it", async () => {
    renderPicker(["editor"])
    await screen.findByRole("button", { name: "Upload new image" })
    choose("prices.pdf", "application/pdf")
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "prices.pdf: This file is not an image this field can use."
    )
    expect(uploadMediaFile).not.toHaveBeenCalled()
  })

  it("never selects an upload the server did not take as an image", async () => {
    uploadMediaFile.mockResolvedValue({
      ...uploaded,
      mime: "application/pdf",
      originalName: "renamed.png",
    })
    renderPicker(["editor"])
    await screen.findByRole("button", { name: "Upload new image" })
    choose("renamed.png", "image/png")
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "renamed.png: This file is not an image this field can use."
    )
    expect(
      screen.getByRole("button", { name: "Use this image" })
    ).toBeDisabled()
  })

  it("sends the optional alternative text with the upload", async () => {
    const user = userEvent.setup()
    uploadMediaFile.mockResolvedValue(uploaded)
    renderPicker(["author"])
    await user.type(
      await screen.findByLabelText(/^Alternative text for the upload/),
      "Guard at the gate"
    )
    choose("new-hero.png", "image/png")
    expect(uploadMediaFile).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({ alt: "Guard at the gate" })
    )
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Use this image" })
      ).toBeEnabled()
    )
    expect(
      screen.getByLabelText(/^Alternative text for the upload/)
    ).toHaveValue("")
  })

  it("an upload finishing after the dialog reopened leaves the new opening alone", async () => {
    let finish!: (item: MediaItem) => void
    uploadMediaFile.mockImplementation(
      () => new Promise<MediaItem>((resolve) => (finish = resolve))
    )
    const session: AdminSession = {
      user: {
        id: "u1",
        name: "E",
        email: "e@example.test",
        title: null,
        twoFactorEnabled: false,
      },
      roles: ["editor"],
      impersonatedBy: null,
    }
    const client = makeQueryClient()
    const view = (open: boolean) => (
      <QueryClientProvider client={client}>
        <AdminSessionProvider value={session}>
          <MediaPickerDialog
            open={open}
            onOpenChange={() => undefined}
            onSelect={vi.fn()}
            title="Choose: Background image"
          />
        </AdminSessionProvider>
      </QueryClientProvider>
    )
    const { rerender } = render(view(true))
    await screen.findByRole("button", { name: "Upload new image" })
    choose("late.png", "image/png")
    rerender(view(false))
    rerender(view(true))
    await screen.findByRole("button", { name: "Upload new image" })
    await act(async () => finish(uploaded))
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(
      screen.getByRole("button", { name: "Use this image" })
    ).toBeDisabled()
    expect(screen.queryByRole("progressbar")).toBeNull()
    expect(
      screen.getByRole("status", { name: "Upload progress" })
    ).toHaveTextContent("")
  })
})
