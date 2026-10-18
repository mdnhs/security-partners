import { z } from "zod"

import { fromPathProblem, toPathProblem } from "@/lib/seo/redirects"

import { listQuery, sortParam } from "./list"

const checked = (problem: (value: string) => string | null) =>
  z.string().superRefine((value, ctx) => {
    const message = problem(value)
    if (message) ctx.addIssue({ code: "custom", message })
  })

export const REDIRECT_CODES = [301, 302] as const

/** POST /redirects. Live pages and loops are checked by the service. */
export const redirectInput = z.object({
  fromPath: checked(fromPathProblem),
  toPath: checked(toPathProblem),
  code: z.union([z.literal(301), z.literal(302)]),
})
export type RedirectInput = z.infer<typeof redirectInput>

/** PATCH /redirects/:id — any subset, at least one field. */
export const redirectPatch = redirectInput
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
  code: 301 | 302
  hits: number
  createdAt: string
  updatedAt: string
}
