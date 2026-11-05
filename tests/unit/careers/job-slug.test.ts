import { describe, expect, it } from "vitest"

import { createJobInput, jobSlugInput } from "@/lib/schemas/api/jobs"

describe("job slugs", () => {
  it("\"apply\" is reserved for the talent pool form (/careers/apply)", () => {
    expect(createJobInput.safeParse({ title: "A", slug: "apply" }).success).toBe(false)
    expect(jobSlugInput.safeParse({ slug: "apply", version: 1 }).success).toBe(false)
    expect(createJobInput.safeParse({ title: "A", slug: "applying" }).success).toBe(true)
  })
})
