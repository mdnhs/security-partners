"use client"

import { useCallback, useId, useSyncExternalStore } from "react"

import { Switch } from "@/components/ui/switch"

/** localStorage key per user: the choice belongs to the person, not the browser. */
export const livePreviewKey = (userId: string) =>
  `sp-admin-live-preview:${userId}`

// Our own writes do not fire "storage" in the same window: announce them.
const CHANGE_EVENT = "sp-admin-live-preview"

// The session's own memory of the choice: what localStorage would say, kept
// when storage is unavailable (private mode, blocked, full) so the switch
// still holds for this visit.
const memory = new Map<string, boolean>()

function read(key: string): boolean {
  try {
    const stored = localStorage.getItem(key)
    if (stored !== null) return stored === "on"
  } catch {
    // Unreadable storage: fall through to the session memory.
  }
  return memory.get(key) ?? false
}

/**
 * The editor's live preview choice (ruling D9): off until turned on,
 * remembered per user in localStorage (for the session only where
 * storage is unavailable).
 */
export function useLivePreview(
  userId: string
): [boolean, (on: boolean) => void] {
  const key = livePreviewKey(userId)
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener("storage", onChange)
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => {
      window.removeEventListener("storage", onChange)
      window.removeEventListener(CHANGE_EVENT, onChange)
    }
  }, [])
  const on = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => false
  )
  const setOn = useCallback(
    (next: boolean) => {
      memory.set(key, next)
      try {
        localStorage.setItem(key, next ? "on" : "off")
      } catch {
        // Nothing durable to remember it in; the session memory holds it.
      }
      window.dispatchEvent(new Event(CHANGE_EVENT))
    },
    [key]
  )
  return [on, setOn]
}

/** "Live preview" switch in the editor bar (shown only where the pane can be). */
export function LivePreviewToggle({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: (on: boolean) => void
}) {
  const labelId = useId()
  return (
    <label className="inline-flex h-10 cursor-pointer items-center gap-2.5 rounded-xl border px-3 text-sm font-semibold pointer-coarse:h-11">
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-labelledby={labelId}
      />
      <span id={labelId}>Live preview</span>
    </label>
  )
}
