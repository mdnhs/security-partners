import { z } from "zod"

export const PAGE_SIZE_DEFAULT = 20
export const PAGE_SIZE_MAX = 100

export type SortDir = "asc" | "desc"
export type Sort<F extends string> = { field: F; dir: SortDir }

/** List response envelope (global constraint). */
export type Paginated<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
}

/** `?sort=field:dir` limited to `fields`; parses to `{ field, dir }`. */
export function sortParam<const F extends string>(
  fields: readonly [F, ...F[]],
  fallback: Sort<NoInfer<F>>
) {
  return z
    .string()
    .regex(/^[A-Za-z]+:(asc|desc)$/, "Use field:asc or field:desc")
    .refine(
      (value) => (fields as readonly string[]).includes(value.split(":")[0]),
      `Sort by one of: ${fields.join(", ")}`
    )
    .transform((value): Sort<F> => {
      const [field, dir] = value.split(":")
      return { field: field as F, dir: dir as SortDir }
    })
    .optional()
    .transform((value) => value ?? fallback)
}

/** `?page&pageSize&q` shared by every list endpoint. */
export const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGE_SIZE_MAX)
    .default(PAGE_SIZE_DEFAULT),
  q: z.string().trim().max(200).optional(),
})
