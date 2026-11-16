import { z } from "zod"

/**
 * Section layout of a fixed page: which sections after the hero are shown,
 * and in what order. The hero is always first and is not part of the list.
 *
 * Stored pages that predate the layout have no `sections`; a missing,
 * partial or stale list is read as "the default order, all visible", so
 * nothing already published changes until an editor touches the layout.
 */
export const sectionState = <const T extends readonly [string, ...string[]]>(
  ids: T
) => z.object({ id: z.enum(ids), visible: z.boolean() })

export const sectionList = <const T extends readonly [string, ...string[]]>(
  ids: T
) => z.array(sectionState(ids)).optional()

export type SectionState = { id: string; visible: boolean }

/** Default order per page (every section visible). */
export const HOME_SECTIONS = [
  "about",
  "services",
  "enquireBanner",
  "clients",
  "team",
  "blog",
  "contact",
  "map",
] as const
export const ABOUT_SECTIONS = [
  "about",
  "stats",
  "values",
  "clients",
  "enquireBanner",
] as const
export const SERVICES_SECTIONS = [
  "services",
  "whyChooseUs",
  "clients",
  "enquireBanner",
] as const
export const TEAM_SECTIONS = ["team", "officers", "enquireBanner"] as const
export const CONTACT_SECTIONS = ["contact", "departments", "map"] as const

/**
 * The full layout: stored entries first (in their order, unknown ids and
 * repeats dropped), then any default section the stored list lacks, in
 * default order and visible. Never loses or duplicates a section.
 */
export function normalizeSections<T extends string>(
  stored: readonly { id: string; visible: boolean }[] | undefined,
  defaults: readonly T[]
): { id: T; visible: boolean }[] {
  const known = new Set<string>(defaults)
  const seen = new Set<string>()
  const out: { id: T; visible: boolean }[] = []
  for (const entry of stored ?? []) {
    if (!known.has(entry.id) || seen.has(entry.id)) continue
    seen.add(entry.id)
    out.push({ id: entry.id as T, visible: entry.visible })
  }
  for (const id of defaults) {
    if (!seen.has(id)) out.push({ id, visible: true })
  }
  return out
}

/** The ids to render after the hero: visible sections, in order. */
export function visibleSections<T extends string>(
  stored: readonly { id: string; visible: boolean }[] | undefined,
  defaults: readonly T[]
): T[] {
  return normalizeSections(stored, defaults)
    .filter((s) => s.visible)
    .map((s) => s.id)
}
