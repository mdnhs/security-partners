import { z } from "zod"

import {
  fromPathProblem,
  REDIRECT_CODES,
  type RedirectCode,
  redirectCode,
  toPathProblem,
} from "@/lib/seo/redirects"

import { listQuery, sortParam } from "./list"

const checked = (problem: (value: string) => string | null) =>
  z.string().superRefine((value, ctx) => {
    const message = problem(value)
    if (message) ctx.addIssue({ code: "custom", message })
  })

export { REDIRECT_CODES, type RedirectCode, redirectCode }
export const REDIRECT_SOURCES = ["manual", "auto", "import"] as const
export type RedirectSource = (typeof REDIRECT_SOURCES)[number]
export const REDIRECT_NOTE_MAX = 200

const fields = {
  fromPath: checked(fromPathProblem),
  toPath: checked(toPathProblem),
  code: z.literal(REDIRECT_CODES),
  /** Admin-only context ("Old brochure link"); never shown to visitors. */
  note: z
    .string()
    .trim()
    .max(REDIRECT_NOTE_MAX, `Keep the note to ${REDIRECT_NOTE_MAX} characters`),
  /** Off keeps the redirect listed but stops it resolving. */
  isActive: z.boolean(),
}

/**
 * POST /redirects. Live pages and loops are checked by the service. `source`
 * is server-owned (manual here; auto from moves; import from CSV).
 */
export const redirectInput = z.object({
  fromPath: fields.fromPath,
  toPath: fields.toPath,
  code: fields.code,
  note: fields.note.default(""),
  isActive: fields.isActive.default(true),
})
export type RedirectInput = z.output<typeof redirectInput>

/** PATCH /redirects/:id — any subset, at least one field. */
export const redirectPatch = z
  .object(fields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Nothing to change")
export type RedirectPatch = z.infer<typeof redirectPatch>

export const redirectListQuery = listQuery.extend({
  sort: sortParam(["fromPath", "hits", "updatedAt"], {
    field: "updatedAt",
    dir: "desc",
  }),
})
export type RedirectListQuery = z.output<typeof redirectListQuery>

export type RedirectDto = {
  id: string
  fromPath: string
  toPath: string
  code: RedirectCode
  hits: number
  /** Last counted hit (ISO); null = never. */
  lastHitAt: string | null
  isActive: boolean
  note: string
  source: RedirectSource
  createdAt: string
  updatedAt: string
}
