import type { z } from "zod"

import { newSnippetId } from "@/lib/analytics/snippets"
import { link, mediaRef, paragraphsText, richText } from "@/lib/schemas/common"
import { snippetId } from "@/lib/schemas/settings/custom-code"

import { arrayBounds, unwrapSchema } from "./resolve-widget"

/**
 * A blank value for a schema (new list items, new records). Required
 * fields start empty and fail validation until filled in; media start as
 * null ("Choose an image").
 */
export function emptyValue(schema: z.ZodType): unknown {
  const { inner, optional, nullable } = unwrapSchema(schema)
  if (optional) return undefined
  if (nullable) return null
  if (inner === mediaRef) return null
  if (inner === richText || inner === paragraphsText)
    return { type: "doc", content: [{ type: "paragraph" }] }
  if (inner === link) return { label: "", href: "" }
  // Only the custom code snippet id is generated (a hidden field); any
  // other uuid stays empty, so a missing reference fails "required".
  if (inner === snippetId) return newSnippetId()
  const def = (inner as unknown as { def: { type: string } }).def
  switch (def.type) {
    case "object": {
      const shape = (inner as z.ZodObject).shape as Record<string, z.ZodType>
      return Object.fromEntries(
        Object.entries(shape)
          .map(([key, child]) => [key, emptyValue(child)] as const)
          .filter(([, value]) => value !== undefined)
      )
    }
    case "array": {
      const { min } = arrayBounds(inner)
      const element = (inner as z.ZodArray<z.ZodType>).element
      return Array.from({ length: min }, () => emptyValue(element))
    }
    case "boolean":
      return false
    case "number":
      return (inner as z.ZodNumber).minValue ?? 0
    case "enum":
      return (inner as z.ZodEnum).options[0]
    default:
      return ""
  }
}
