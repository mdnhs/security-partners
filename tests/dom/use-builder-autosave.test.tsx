import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { DraftDocumentValue } from "@/components/admin/builder/builder-state"
import {
  BUILDER_AUTOSAVE_MS,
  BUILDER_RETRY_MS,
  UnsavedChangesError,
  useBuilderAutosave,
} from "@/components/admin/builder/use-builder-autosave"
import { ApiError } from "@/lib/api-client"
import type { BuilderPageDto } from "@/lib/schemas/api/builder-pages"

const docWith = (anchor: string): DraftDocumentValue => ({
  blocks: [
    {
      id: "hero-1",
      type: "hero.page",
      anchor,
      hidden: false,
      data: {},
    },
  ],
})

const dto = (version: number, draft = docWith("a")): BuilderPageDto =>
  ({ id: "p1", version, draft }) as unknown as BuilderPageDto

const conflictError = (current: BuilderPageDto) =>
  new ApiError(409, {
    error: { code: "CONFLICT", message: "Changed", current },
  })

type Props = { doc: DraftDocumentValue; enabled?: boolean }

function setup(
  save: (doc: DraftDocumentValue, version: number) => Promise<BuilderPageDto>
) {
  return renderHook(
    ({ doc, enabled = true }: Props) =>
      useBuilderAutosave({ id: "p1", version: 3, doc, enabled, save }),
    { initialProps: { doc: docWith("a") } as Props }
  )
}

const tick = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe("useBuilderAutosave", () => {
  it("saves 1500 ms after the last edit with the current version, then reports Saved", async () => {
    const save = vi.fn(async (_doc: DraftDocumentValue, v: number) =>
      dto(v + 1)
    )
    const { result, rerender } = setup(save)
    expect(result.current.state).toBe("saved")
    rerender({ doc: docWith("b") })
    expect(result.current.state).toBe("unsaved")
    await tick(BUILDER_AUTOSAVE_MS - 1)
    expect(save).not.toHaveBeenCalled()
    await tick(1)
    expect(save).toHaveBeenCalledWith(docWith("b"), 3)
    expect(result.current.state).toBe("saved")
    expect(result.current.version()).toBe(4)
    expect(result.current.savedCount).toBe(1)
  })

  it("one request in flight: an edit made meanwhile is sent after it, on the new version", async () => {
    let resolve!: (d: BuilderPageDto) => void
    const save = vi
      .fn<(doc: DraftDocumentValue, v: number) => Promise<BuilderPageDto>>()
      .mockImplementationOnce(
        () => new Promise<BuilderPageDto>((r) => (resolve = r))
      )
      .mockImplementation(async (_d, v) => dto(v + 1))
    const { result, rerender } = setup(save)
    rerender({ doc: docWith("b") })
    await tick(BUILDER_AUTOSAVE_MS)
    expect(result.current.state).toBe("saving")
    rerender({ doc: docWith("c") })
    await tick(BUILDER_AUTOSAVE_MS * 2)
    expect(save).toHaveBeenCalledTimes(1)
    await act(async () => resolve(dto(4)))
    await tick(BUILDER_AUTOSAVE_MS)
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith(docWith("c"), 4)
    expect(result.current.state).toBe("saved")
  })

  it("409 → conflict: nothing more is sent until accept(); Overwrite keeps mine on their version", async () => {
    const theirs = dto(9, docWith("theirs"))
    const save = vi
      .fn<(doc: DraftDocumentValue, v: number) => Promise<BuilderPageDto>>()
      .mockRejectedValueOnce(conflictError(theirs))
      .mockImplementation(async (_d, v) => dto(v + 1))
    const { result, rerender } = setup(save)
    rerender({ doc: docWith("b") })
    await tick(BUILDER_AUTOSAVE_MS)
    expect(result.current.state).toBe("conflict")
    expect(result.current.conflict).toEqual(theirs)
    rerender({ doc: docWith("c") })
    await tick(BUILDER_RETRY_MS * 2)
    expect(save).toHaveBeenCalledTimes(1)
    expect(await act(() => result.current.flush())).toBe(false)

    act(() => result.current.accept(theirs, { keepMine: true }))
    expect(result.current.state).toBe("unsaved")
    await act(() => result.current.flush())
    expect(save).toHaveBeenLastCalledWith(docWith("c"), 9)
    expect(result.current.state).toBe("saved")
  })

  it("accept(theirs) (Reload theirs) makes their document the saved one", async () => {
    const theirs = dto(9, docWith("theirs"))
    const save = vi.fn().mockRejectedValueOnce(conflictError(theirs))
    const { result, rerender } = setup(save)
    rerender({ doc: docWith("b") })
    await tick(BUILDER_AUTOSAVE_MS)
    act(() => result.current.accept(theirs))
    rerender({ doc: theirs.draft })
    expect(result.current.state).toBe("saved")
    await tick(BUILDER_AUTOSAVE_MS * 2)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it("a transient failure retries after 5 s; a 4xx waits for the next edit", async () => {
    const save = vi
      .fn<(doc: DraftDocumentValue, v: number) => Promise<BuilderPageDto>>()
      .mockRejectedValueOnce(new ApiError(503, null))
      .mockImplementation(async (_d, v) => dto(v + 1))
    const { result, rerender } = setup(save)
    rerender({ doc: docWith("b") })
    await tick(BUILDER_AUTOSAVE_MS)
    expect(result.current.state).toBe("error")
    await tick(BUILDER_RETRY_MS - 1)
    expect(save).toHaveBeenCalledTimes(1)
    await tick(1)
    expect(save).toHaveBeenCalledTimes(2)
    expect(result.current.state).toBe("saved")

    save.mockRejectedValueOnce(new ApiError(422, null))
    rerender({ doc: docWith("c") })
    await tick(BUILDER_AUTOSAVE_MS)
    expect(result.current.state).toBe("error")
    await tick(BUILDER_RETRY_MS * 3)
    expect(save).toHaveBeenCalledTimes(3)
    rerender({ doc: docWith("d") })
    await tick(BUILDER_AUTOSAVE_MS)
    expect(save).toHaveBeenCalledTimes(4)
  })

  it("exclusive (publish) saves the pending edit first, then runs with the version that save returned", async () => {
    const order: string[] = []
    const save = vi.fn(async (_d: DraftDocumentValue, v: number) => {
      order.push(`save@${v}`)
      return dto(v + 1)
    })
    const { result, rerender } = setup(save)
    rerender({ doc: docWith("b") })
    const published = await act(() =>
      result.current.exclusive(async (v) => {
        order.push(`publish@${v}`)
        return dto(v + 1, docWith("b"))
      })
    )
    expect(order).toEqual(["save@3", "publish@4"])
    expect(published.version).toBe(5)
    expect(result.current.version()).toBe(5)
  })

  it("exclusive refuses to run while a conflict is open (never overwrites silently)", async () => {
    const save = vi.fn().mockRejectedValueOnce(conflictError(dto(9)))
    const { result, rerender } = setup(save)
    rerender({ doc: docWith("b") })
    await tick(BUILDER_AUTOSAVE_MS)
    const request = vi.fn()
    await expect(
      act(() => result.current.exclusive(request))
    ).rejects.toBeInstanceOf(UnsavedChangesError)
    expect(request).not.toHaveBeenCalled()
  })

  it("a 409 from the exclusive request itself opens the conflict", async () => {
    const save = vi.fn()
    const { result } = setup(save)
    const theirs = dto(9)
    await expect(
      act(() =>
        result.current.exclusive(async () => {
          throw conflictError(theirs)
        })
      )
    ).rejects.toBeInstanceOf(ApiError)
    await act(async () => {})
    expect(result.current.state).toBe("conflict")
    expect(result.current.conflict).toEqual(theirs)
  })

  it("Overwrite after a 409 from an exclusive request (publish) really sends mine on their version (review D5.5 I1)", async () => {
    const save = vi.fn(async (_d: DraftDocumentValue, v: number) => dto(v + 1))
    const { result, rerender } = setup(save)
    // Mine is saved (nothing pending) when publish meets their newer save.
    rerender({ doc: docWith("mine") })
    await tick(BUILDER_AUTOSAVE_MS)
    expect(save).toHaveBeenCalledTimes(1)
    expect(result.current.state).toBe("saved")
    const theirs = dto(9, docWith("theirs"))
    await expect(
      act(() =>
        result.current.exclusive(async () => {
          throw conflictError(theirs)
        })
      )
    ).rejects.toBeInstanceOf(ApiError)
    await act(async () => {})
    expect(result.current.state).toBe("conflict")

    act(() => result.current.accept(theirs, { keepMine: true }))
    // The saved copy is now theirs, so mine is a pending change…
    expect(result.current.state).toBe("unsaved")
    expect(await act(() => result.current.flush())).toBe(true)
    // …and it is sent, on their version.
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith(docWith("mine"), 9)
    expect(result.current.state).toBe("saved")
  })

  it("accept reads the saved copy through readDraft (same parse as the editor)", async () => {
    const save = vi.fn()
    const { result, rerender } = setup(save)
    // Their draft carries an extra key the parse strips: still "saved".
    const theirs = dto(9, {
      blocks: [{ ...docWith("x").blocks[0], extra: 1 } as never],
    })
    act(() => result.current.accept(theirs))
    rerender({ doc: docWith("x") })
    expect(result.current.state).toBe("saved")
    await tick(BUILDER_AUTOSAVE_MS * 2)
    expect(save).not.toHaveBeenCalled()
  })

  it("exclusive with discardPending sends nothing pending first (Discard)", async () => {
    const save = vi.fn(async (_d: DraftDocumentValue, v: number) => dto(v + 1))
    const { result, rerender } = setup(save)
    rerender({ doc: docWith("about-to-go") })
    const request = vi.fn(async (v: number) => dto(v + 1, docWith("a")))
    await act(() => result.current.exclusive(request, { discardPending: true }))
    expect(save).not.toHaveBeenCalled()
    expect(request).toHaveBeenCalledWith(3)
  })

  it("flushes when the tab is hidden", async () => {
    const save = vi.fn(async (_d: DraftDocumentValue, v: number) => dto(v + 1))
    const { rerender } = setup(save)
    rerender({ doc: docWith("b") })
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    })
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
    })
    // keepalive: the request may outlive a closing tab (review D5.5 M6).
    expect(save).toHaveBeenCalledWith(docWith("b"), 3, { keepalive: true })
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    })
  })

  it("switching saving off (an unreadable draft) sends nothing: not on the switch, a flush or unmount", async () => {
    const save = vi.fn(async (_d: DraftDocumentValue, v: number) => dto(v + 1))
    const { result, rerender, unmount } = setup(save)
    rerender({ doc: docWith("pending") })
    rerender({ doc: docWith("pending"), enabled: false })
    await tick(BUILDER_AUTOSAVE_MS * 2)
    expect(await act(() => result.current.flush())).toBe(true)
    unmount()
    await tick(10)
    expect(save).not.toHaveBeenCalled()
  })

  it("read-only (enabled false) never saves", async () => {
    const save = vi.fn()
    const { rerender } = setup(save)
    rerender({ doc: docWith("b"), enabled: false })
    await tick(BUILDER_AUTOSAVE_MS * 3)
    expect(save).not.toHaveBeenCalled()
  })
})
