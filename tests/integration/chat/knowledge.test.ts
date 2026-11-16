import { eq } from "drizzle-orm"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import { pages } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import {
  buildKnowledge,
  clearKnowledgeCache,
  KNOWLEDGE_MAX,
} from "@/server/modules/chat/knowledge"

import { resetDb } from "../db"

const setPage = (key: string, patch: Partial<typeof pages.$inferInsert>) =>
  getDb().update(pages).set(patch).where(eq(pages.key, key))

beforeAll(async () => {
  await resetDb()
  await seedContent(getDb())
})

beforeEach(clearKnowledgeCache)

describe("chat knowledge", () => {
  it("includes contact details and the quote address", async () => {
    const text = await buildKnowledge()
    expect(text.startsWith("## Contact\n")).toBe(true)
    expect(text).toContain("Phone: 057 8697670")
    expect(text).toContain("Operations mobile: 085 859 1299")
    expect(text).toContain("24 hour line: (085) 8018746")
    expect(text).toContain("Hours: Monday–Friday, 9am to 6pm")
    expect(text).toContain(
      "Address: Derryguile, Mountmellick, Co. Laois, R32 YX49"
    )
    expect(text).toContain("Quote form: /contact")
    expect(text).toContain("\n\n## Services\n")
    expect(text.length).toBeLessThanOrEqual(KNOWLEDGE_MAX)
  })

  it("never includes draft-only text", async () => {
    const [about] = await getDb()
      .select()
      .from(pages)
      .where(eq(pages.key, "about"))
    await setPage("about", {
      draft: { ...(about!.draft as object), secret: "Unpublished zebra offer" },
    })
    clearKnowledgeCache()
    expect(await buildKnowledge()).not.toContain("zebra")
    await setPage("about", { draft: about!.draft })
  })

  it("serves the cached text until the cache is cleared", async () => {
    const first = await buildKnowledge()
    const [home] = await getDb()
      .select()
      .from(pages)
      .where(eq(pages.key, "home"))
    await setPage("home", { published: { note: "Fresh walrus text." } })
    expect(await buildKnowledge()).toBe(first)
    clearKnowledgeCache()
    expect(await buildKnowledge()).toContain("Fresh walrus text.")
    await setPage("home", { published: home!.published })
  })

  it("caps at 8000 chars with a sentence cut and …", async () => {
    const [home] = await getDb()
      .select()
      .from(pages)
      .where(eq(pages.key, "home"))
    const long = Array.from(
      { length: 600 },
      (_, i) => `Sentence ${i} is about security.`
    ).join(" ")
    await setPage("home", { published: { intro: long } })
    clearKnowledgeCache()
    const text = await buildKnowledge()
    expect(text.length).toBeLessThanOrEqual(KNOWLEDGE_MAX)
    expect(text.endsWith(".…")).toBe(true)
    expect(text).toContain("## Home\nintro: Sentence 0 is about security.")
    expect(text).not.toContain("## Careers")
    await setPage("home", { published: home!.published })
  })
})
