"use client"

import { useCallback, useId, useSyncExternalStore } from "react"

import { Switch } from "@/components/ui/switch"

/** localStorage key per user: the choice belongs to the person, not the browser. */
export const livePreviewKey = (userId: string) =>
  `sp-admin-live-preview:${userId}`

// Our own writes do not fire "storage" in the same window: announce them.
const CHANGE_EVENT = "sp-admin-live-preview"

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === "on"
  } catch {
    return false
  }
}

/**
 * The editor's live preview choice (ruling D9): off until turned on,
 * remembered per user in localStorage. Storage may be unavailable
 * (private mode, blocked): then it is simply off each visit.
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
      try {
        localStorage.setItem(key, next ? "on" : "off")
      } catch {
        // Nothing to remember it in; the pane follows the switch while it exists.
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
