import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import { jobOpenings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { removeDemoJobs, seedDemoJobs } from "@/server/db/seed/demo-jobs"

import { resetDb } from "../db"

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
})

describe("demo jobs (Figma careers data)", () => {
  it("seeds the eight openings once and removes only them", async () => {
    expect(await seedDemoJobs(getDb())).toBe(8)
    expect(await seedDemoJobs(getDb())).toBe(0)
    const [demo] = await getDb().select().from(jobOpenings).limit(1)
    await getDb()
      .insert(jobOpenings)
      .values({ slug: "real-role", draft: demo.draft, published: null })
    expect(await removeDemoJobs(getDb())).toBe(8)
    const left = await getDb().select({ slug: jobOpenings.slug }).from(jobOpenings)
    expect(left.map((r) => r.slug)).toEqual(["real-role"])
  })
})
