"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { ApiError } from "@/lib/api-client"
import { isDeepEqual } from "@/lib/json"
import type { BuilderPageDto } from "@/lib/schemas/api/builder-pages"

import type { DraftDocumentValue } from "./builder-state"

/** Save-state pill values (SaveStateIndicator labels them). */
export type BuilderSaveState =
  "saved" | "saving" | "unsaved" | "conflict" | "error"

export const BUILDER_AUTOSAVE_MS = 1500
export const BUILDER_RETRY_MS = 5000

/** Thrown by exclusive() when the draft could not be saved first. */
export class UnsavedChangesError extends Error {
  constructor() {
    super("Your latest changes are not saved yet.")
    this.name = "UnsavedChangesError"
  }
}

/** Offline, timeouts, rate limits and 5xx fix themselves; a 4xx does not. */
const transient = (error: unknown) =>
  !(error instanceof ApiError) ||
  error.status === 0 ||
  error.status === 408 ||
  error.status === 429 ||
  error.status >= 500

/**
 * The page builder's autosave (spec §7.5, Review Focus 5): 1500 ms after
 * the last edit; one request in flight, the newest document wins; a 409
 * parks it in "conflict" and nothing is sent until `accept(dto)`; a
 * transient failure retries after 5 s, a 4xx waits for the next edit.
 * Pending edits are flushed when the tab is hidden and on unmount.
 * `exclusive(request)` is for publish / restore / discard: it saves what
 * is pending first, holds autosave while the request runs and hands it
 * the latest version, so a publish never races an autosave.
 */
export function useBuilderAutosave(input: {
  id: string
  version: number
  doc: DraftDocumentValue
  enabled: boolean
  save(doc: DraftDocumentValue, version: number): Promise<BuilderPageDto>
}): {
  state: BuilderSaveState
  /** Saves now; true when the server holds the current document. */
  flush(): Promise<boolean>
  /**
   * Takes a record from elsewhere (their version after a conflict, a
   * publish / restore result). `keepMine`: their version, my document
   * (Overwrite): the next save sends mine on their version.
   */
  accept(dto: BuilderPageDto, options?: { keepMine?: boolean }): void
  exclusive(
    request: (version: number) => Promise<BuilderPageDto>
  ): Promise<BuilderPageDto>
  /** The version the next request must carry. */
  version(): number
  /** Their record, after a 409. */
  conflict: BuilderPageDto | null
  /** Bumps after every successful save (preview reload). */
  savedCount: number
} {
  const { doc, enabled } = input
  const version = useRef(input.version)
  const latest = useRef(doc)
  const saveRef = useRef(input.save)
  useEffect(() => {
    latest.current = doc
    saveRef.current = input.save
  })
  // What the server holds: a ref for the save loop, state for render.
  const savedRef = useRef(doc)
  const [savedDoc, setSavedDoc] = useState(doc)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const conflictRef = useRef<BuilderPageDto | null>(null)
  const [conflict, setConflict] = useState<BuilderPageDto | null>(null)
  const [paused, setPaused] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const running = useRef<Promise<unknown> | null>(null)
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [held, setHeld] = useState(0)
  // Bumped by the retry timer; the effect below saves again.
  const [retries, setRetries] = useState(0)

  const markSaved = (value: DraftDocumentValue) => {
    savedRef.current = value
    setSavedDoc(value)
  }
  const clearRetry = () => {
    if (retry.current) clearTimeout(retry.current)
    retry.current = null
  }

  const flush = useCallback(async (): Promise<boolean> => {
    clearRetry()
    while (running.current) await running.current.catch(() => undefined)
    if (conflictRef.current) return false
    const value = latest.current
    if (isDeepEqual(value, savedRef.current)) return true
    const attempt = (async () => {
      setSaving(true)
      setError(null)
      try {
        const dto = await saveRef.current(value, version.current)
        version.current = dto.version
        markSaved(value)
        setSavedCount((n) => n + 1)
        return true
      } catch (err) {
        if (err instanceof ApiError && err.isConflict) {
          const current = (err.current ?? null) as BuilderPageDto | null
          conflictRef.current = current ?? ({} as BuilderPageDto)
          setConflict(current)
          setPaused(true)
        } else {
          setError(err)
          if (transient(err) && !retry.current)
            retry.current = setTimeout(() => {
              retry.current = null
              setRetries((n) => n + 1)
            }, BUILDER_RETRY_MS)
        }
        return false
      } finally {
        setSaving(false)
      }
    })()
    running.current = attempt
    try {
      return await attempt
    } finally {
      if (running.current === attempt) running.current = null
    }
  }, [])

  const dirty = !isDeepEqual(doc, savedDoc)

  useEffect(() => {
    if (retries > 0) void flush()
  }, [retries, flush])

  // Editing again after a failed save clears the error (a new attempt).
  const lastDoc = useRef(doc)
  useEffect(() => {
    if (lastDoc.current === doc) return
    lastDoc.current = doc
    setError(null)
  }, [doc])

  useEffect(() => {
    if (!enabled || !dirty || paused || error || saving || held) return
    const timer = setTimeout(() => void flush(), BUILDER_AUTOSAVE_MS)
    return () => clearTimeout(timer)
  }, [doc, enabled, dirty, paused, error, saving, held, flush])

  // Tab hidden: save now (a phone may never come back). Unmount too.
  useEffect(() => {
    if (!enabled) return
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void flush()
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      void flush()
    }
  }, [enabled, flush])

  useEffect(() => () => clearRetry(), [])

  const exclusive = useCallback(
    async (request: (version: number) => Promise<BuilderPageDto>) => {
      if (!(await flush())) throw new UnsavedChangesError()
      let release = () => {}
      const hold = new Promise<void>((resolve) => {
        release = resolve
      })
      running.current = hold
      setHeld((n) => n + 1)
      try {
        const dto = await request(version.current)
        version.current = dto.version
        return dto
      } catch (err) {
        if (err instanceof ApiError && err.isConflict) {
          const current = (err.current ?? null) as BuilderPageDto | null
          conflictRef.current = current ?? ({} as BuilderPageDto)
          setConflict(current)
          setPaused(true)
        }
        throw err
      } finally {
        if (running.current === hold) running.current = null
        release()
        setHeld((n) => n - 1)
      }
    },
    [flush]
  )

  const accept = useCallback(
    (dto: BuilderPageDto, options?: { keepMine?: boolean }) => {
      version.current = dto.version
      conflictRef.current = null
      setConflict(null)
      setPaused(false)
      setError(null)
      clearRetry()
      if (!options?.keepMine) markSaved(dto.draft)
    },
    []
  )

  const state: BuilderSaveState = saving
    ? "saving"
    : paused
      ? "conflict"
      : error
        ? "error"
        : dirty
          ? "unsaved"
          : "saved"

  return {
    state,
    flush,
    accept,
    exclusive,
    version: useCallback(() => version.current, []),
    conflict,
    savedCount,
  }
}
