import { z } from "zod"

import { mediaRef, paragraphsText, richText } from "@/lib/schemas/common"

/**
 * Field paths of a Zod object schema, in the inventory's notation:
 * "hero.heading", "stats[].value", "highlights[]". `lists` holds the array
 * paths themselves ("stats"); media refs and rich text are leaves.
 */
export type SchemaPaths = { leaves: Set<string>; lists: Set<string> }

function unwrap(schema: z.ZodType): z.ZodType {
  let current = schema
  while (
    current instanceof z.ZodOptional ||
    current instanceof z.ZodNullable ||
    current instanceof z.ZodDefault
  )
    current = current.def.innerType as z.ZodType
  return current
}

function walk(schema: z.ZodType, path: string, out: SchemaPaths): void {
  const inner = unwrap(schema)
  if (inner === mediaRef || inner === richText || inner === paragraphsText) {
    out.leaves.add(path)
    return
  }
  if (inner instanceof z.ZodObject) {
    for (const [key, child] of Object.entries(inner.shape))
      walk(child as z.ZodType, path ? `${path}.${key}` : key, out)
    return
  }
  if (inner instanceof z.ZodArray) {
    out.lists.add(path)
    const element = unwrap(inner.element as z.ZodType)
    if (element instanceof z.ZodObject && element !== mediaRef)
      walk(element, `${path}[]`, out)
    else out.leaves.add(`${path}[]`)
    return
  }
  out.leaves.add(path)
}

export function schemaPaths(schema: z.ZodType): SchemaPaths {
  const out: SchemaPaths = { leaves: new Set(), lists: new Set() }
  walk(schema, "", out)
  return out
}
