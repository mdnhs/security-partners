"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useRef, useState } from "react"

import { useAutosave } from "@/hooks/use-autosave"
import { ApiError, api, unwrap } from "@/lib/api-client"
import type { ThemeDto } from "@/lib/schemas/api/theme"
import { ThemeConfig, type ThemeConfigValue } from "@/lib/theme/schema"

export const THEME_QUERY_KEY = ["appearance"] as const
export const THEME_REVISIONS_KEY = ["revisions", "settings", "theme"] as const

const isValid = (value: ThemeConfigValue) =>
  ThemeConfig.safeParse(value).success

/**
 * The theme draft with autosave (spec §8.2 rules: 1.5 s debounce, one save
 * in flight, a 409 parks it in "conflict" until resolved). Discard, reset,
 * restore and publish run through `run`, which saves pending edits first
 * and sends the version that save returned.
 */
export function useThemeAutosave({
  initial,
  enabled,
  delay,
}: {
  initial: ThemeDto
  enabled: boolean
  delay?: number
}) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<ThemeConfigValue>(initial.draft)
  const [record, setRecord] = useState<ThemeDto>(initial)
  const [saved, setSaved] = useState<ThemeConfigValue>(initial.draft)
  // The version to send next: updated synchronously after every response.
  const versionRef = useRef(initial.version)

  const accept = useCallback(
    (dto: ThemeDto, savedDraft: ThemeConfigValue = dto.draft) => {
      versionRef.current = dto.version
      setRecord(dto)
      setSaved(savedDraft)
      queryClient.setQueryData(THEME_QUERY_KEY, dto)
    },
    [queryClient]
  )

  const autosave = useAutosave<ThemeConfigValue>({
    value: draft,
    savedValue: saved,
    isValid,
    delay,
    enabled,
    save: async (value) => {
      const dto = await unwrap(
        api.appearance.draft.$put({
          json: { version: versionRef.current, draft: value },
        })
      )
      accept(dto, value)
    },
  })

  /** A whole new draft from the server (discard, reset, restore, theirs). */
  const replace = useCallback(
    (dto: ThemeDto) => {
      accept(dto)
      setDraft(dto.draft)
    },
    [accept]
  )

  const { flush } = autosave
  /** Saves pending edits, then `call(version)`; the answer becomes the draft. */
  const run = useCallback(
    async (call: (version: number) => Promise<ThemeDto>) => {
      if (!(await flush()))
        throw autosave.conflict ?? new Error("Save your changes first.")
      const dto = await call(versionRef.current)
      replace(dto)
      return dto
    },
    [flush, autosave.conflict, replace]
  )

  /** Their record (a 409's `current`) becomes the base; mine is saved over it. */
  const overwrite = useCallback(
    async (theirs: ThemeDto) => {
      versionRef.current = theirs.version
      setRecord(theirs)
      setSaved(theirs.draft)
      autosave.resolveConflict()
      return flush()
    },
    [autosave, flush]
  )

  const conflictDto =
    autosave.conflict instanceof ApiError
      ? ((autosave.conflict.current as ThemeDto | undefined) ?? null)
      : null

  return {
    draft,
    setDraft,
    record,
    /** The draft differs from what is live (saved or not yet). */
    hasDraft: record.hasDraft || autosave.dirty,
    state: autosave.state,
    conflict: autosave.conflict,
    conflictDto,
    flush,
    run,
    replace,
    overwrite,
    resolveConflict: autosave.resolveConflict,
  }
}
