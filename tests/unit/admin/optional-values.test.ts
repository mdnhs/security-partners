import { describe, expect, it } from "vitest"
import { z } from "zod"

import {
  fromFormValues,
  toFormValues,
} from "@/components/admin/schema-form/optional-values"
import { text } from "@/lib/schemas/common"

const schema = z.object({
  a: text,
  b: z.string().optional(),
  c: z.string().nullable(),
  items: z.array(z.object({ n: z.number().optional(), m: text })),
})

describe("optional values inside SchemaForm", () => {
  it("fills missing optionals with null and drops them again", () => {
    const value = { a: "x", c: null, items: [{ m: "y" }, { n: 2, m: "z" }] }
    const form = toFormValues(schema, value)
    expect(form).toEqual({
      a: "x",
      b: null,
      c: null,
      items: [
        { n: null, m: "y" },
        { n: 2, m: "z" },
      ],
    })
    expect(value).not.toHaveProperty("b")
    // Nullable keys keep their null; optional-only keys are omitted.
    expect(fromFormValues(schema, form)).toEqual(value)
    expect(fromFormValues(schema, form)).not.toHaveProperty("b")
  })
})
