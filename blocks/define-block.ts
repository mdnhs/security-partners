import type { z } from "zod"

/**
 * One entry of the page builder's block library (spec §7.5). Each block
 * wraps an existing public section component; the schema is the data an
 * editor fills in, `defaults` what a freshly added block starts with
 * (autosave accepts it as a draft; publish runs the full schema).
 */
export type BlockDefinition<T extends string, S extends z.ZodType> = {
  type: T
  label: string
  /** lucide-react icon name for the admin block library. */
  icon: string
  description: string
  schema: S
  defaults: Partial<z.input<S>>
  /** At most this many per page. */
  max?: number
  /** Must be the page's first block. */
  first?: boolean
}

export function defineBlock<const T extends string, S extends z.ZodType>(
  definition: BlockDefinition<T, S>
): BlockDefinition<T, S> {
  return definition
}
