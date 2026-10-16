import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useAutosave } from "@/hooks/use-autosave"
import { ApiError } from "@/lib/api-client"

type Props = { value: { t: string }; savedValue: { t: string } }

function setup(save: (v: { t: string }) => Promise<void>, initial: Props) {
  return renderHook(
    (props: Props) =>
      useAutosave({ ...props, save, isValid: (v) => v.t !== "", delay: 30 }),
    { initialProps: initial }
  )
}

describe("useAutosave (spec §8.2)", () => {
  it("is saved when nothing changed and saves after the debounce", async () => {
    const save = vi.fn(async () => undefined)
    const { result, rerender } = setup(save, {
      value: { t: "a" },
      savedValue: { t: "a" },
    })
    expect(result.current.state).toBe("saved")
    rerender({ value: { t: "ab" }, savedValue: { t: "a" } })
    expect(result.current.state).toBe("unsaved")
    await waitFor(() => expect(save).toHaveBeenCalledWith({ t: "ab" }))
    expect(save).toHaveBeenCalledTimes(1)
  })

  it("never sends invalid values", async () => {
    const save = vi.fn(async () => undefined)
    const { result, rerender } = setup(save, {
      value: { t: "a" },
      savedValue: { t: "a" },
    })
    rerender({ value: { t: "" }, savedValue: { t: "a" } })
    expect(result.current.state).toBe("invalid")
    await new Promise((r) => setTimeout(r, 80))
    expect(save).not.toHaveBeenCalled()
    await act(async () => expect(await result.current.flush()).toBe(false))
  })

  it("flush() saves immediately (⌘S) and reports success", async () => {
    const save = vi.fn(async () => undefined)
    const { result, rerender } = setup(save, {
      value: { t: "a" },
      savedValue: { t: "a" },
    })
    rerender({ value: { t: "now" }, savedValue: { t: "a" } })
    await act(async () => expect(await result.current.flush()).toBe(true))
    expect(save).toHaveBeenCalledWith({ t: "now" })
  })

  it("parks in conflict on 409 until resolved, and in error on other failures", async () => {
    const conflict = new ApiError(409, {
      error: { code: "CONFLICT", message: "Changed", current: { version: 3 } },
    })
    const save = vi
      .fn()
      .mockRejectedValueOnce(conflict)
      .mockRejectedValueOnce(new TypeError("offline"))
    const { result, rerender } = setup(save, {
      value: { t: "a" },
      savedValue: { t: "a" },
    })
    rerender({ value: { t: "b" }, savedValue: { t: "a" } })
    await waitFor(() => expect(result.current.state).toBe("conflict"))
    expect(result.current.conflict?.current).toEqual({ version: 3 })
    await new Promise((r) => setTimeout(r, 80))
    expect(save).toHaveBeenCalledTimes(1)
    act(() => result.current.resolveConflict())
    await waitFor(() => expect(result.current.state).toBe("error"))
  })
})
