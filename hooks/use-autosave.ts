"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { ApiError } from "@/lib/api-client"
import { isDeepEqual } from "@/lib/json"

/** Save-state indicator values (spec §8.2: Saved / Saving / Unsaved / Conflict). */
export type SaveState =
  "saved" | "saving" | "unsaved" | "invalid" | "conflict" | "error"

export const AUTOSAVE_DELAY_MS = 1500

/**
 * Debounced autosave of `value` against the last saved value. Invalid
 * values are never sent (the form shows the errors); a 409 parks the hook
 * in "conflict" until `resolveConflict()`; other failures → "error" with
 * `flush()` to retry. `flush()` saves now (⌘S, before publish).
 */
export function useAutosave<T>({
  value,
  savedValue,
  save,
  isValid,
  delay = AUTOSAVE_DELAY_MS,
  enabled = true,
}: {
  value: T
  savedValue: T
  save: (value: T) => Promise<void>
  isValid: (value: T) => boolean
  delay?: number
  enabled?: boolean
}) {
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState<ApiError | null>(null)
  const [error, setError] = useState<unknown>(null)
  const latest = useRef({ value, save, isValid })
  useEffect(() => {
    latest.current = { value, save, isValid }
  })
  const inFlight = useRef<Promise<boolean> | null>(null)
  // What the server holds now. Updated synchronously when a save succeeds
  // (the parent's `savedValue` only catches up on its next render), so a
  // flush queued behind an in-flight save never sends the same value twice.
  const lastSaved = useRef(savedValue)
  useEffect(() => {
    lastSaved.current = savedValue
  }, [savedValue])

  const dirty = !isDeepEqual(value, savedValue)
  const valid = isValid(value)

  const flush = useCallback(async (): Promise<boolean> => {
    while (inFlight.current) await inFlight.current
    const { value: current, save: run, isValid: check } = latest.current
    if (isDeepEqual(current, lastSaved.current)) return true
    if (!check(current)) return false
    const attempt = (async () => {
      setSaving(true)
      setError(null)
      try {
        await run(current)
        lastSaved.current = current
        return true
      } catch (err) {
        if (err instanceof ApiError && err.isConflict) setConflict(err)
        else setError(err)
        return false
      } finally {
        setSaving(false)
      }
    })()
    inFlight.current = attempt
    try {
      return await attempt
    } finally {
      if (inFlight.current === attempt) inFlight.current = null
    }
  }, [])

  // Editing again after a failed save retries (the error clears).
  const lastValue = useRef(value)
  useEffect(() => {
    if (isDeepEqual(lastValue.current, value)) return
    lastValue.current = value
    setError(null)
  }, [value])

  useEffect(() => {
    if (!enabled || !dirty || !valid || conflict || error || saving) return
    const id = setTimeout(() => void flush(), delay)
    return () => clearTimeout(id)
  }, [value, enabled, dirty, valid, conflict, error, saving, delay, flush])

  const state: SaveState = saving
    ? "saving"
    : conflict
      ? "conflict"
      : error
        ? "error"
        : !dirty
          ? "saved"
          : !valid
            ? "invalid"
            : "unsaved"

  return {
    state,
    dirty,
    conflict,
    error,
    flush,
    resolveConflict: () => setConflict(null),
    clearError: () => setError(null),
  }
}
