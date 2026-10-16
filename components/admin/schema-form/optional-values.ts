import type { z } from "zod"

import { unwrapSchema } from "./resolve-widget"

// react-hook-form shows a field's *default* value whenever its current value
// is undefined (useController/useWatch fall back to defaultValues). A cleared
// optional field would then re-display what it held before, and a reordered
// list item would show another item's default for a missing optional key.
// Inside the form, missing optionals are therefore null; they are dropped
// again before validation and before values leave SchemaForm.

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const typeOf = (schema: z.ZodType) =>
  (schema as unknown as { def: { type: string } }).def.type

function walk(
  schema: z.ZodType,
  value: unknown,
  onKey: (
    object: Record<string, unknown>,
    key: string,
    child: { optional: boolean; nullable: boolean }
  ) => void
): void {
  const { inner } = unwrapSchema(schema)
  const type = typeOf(inner)
  if (type === "object" && isRecord(value)) {
    for (const [key, child] of Object.entries(
      (inner as z.ZodObject).shape as Record<string, z.ZodType>
    )) {
      onKey(value, key, unwrapSchema(child))
      walk(child, value[key], onKey)
    }
  } else if (type === "array" && Array.isArray(value)) {
    const element = (inner as z.ZodArray<z.ZodType>).element
    for (const item of value) walk(element, item, onKey)
  }
}

/** Copy of `value` with every missing optional key set to null (form state). */
export function toFormValues<T>(schema: z.ZodType, value: T): T {
  const copy = structuredClone(value)
  walk(schema, copy, (object, key, { optional }) => {
    if (optional && object[key] === undefined) object[key] = null
  })
  return copy
}

/** Copy of form state with null optional (non-nullable) keys removed. */
export function fromFormValues<T>(schema: z.ZodType, value: T): T {
  const copy = structuredClone(value)
  walk(schema, copy, (object, key, { optional, nullable }) => {
    if (optional && !nullable && object[key] === null) delete object[key]
  })
  return copy
}
