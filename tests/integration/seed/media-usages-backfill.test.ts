import { and, eq } from "drizzle-orm"
import { beforeAll, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import {
  articles,
  clients,
  groupCompanies,
  media,
  mediaUsages,
  teamMembers,
} from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { backfillMediaUsages } from "@/server/lib/media-usages"

import { resetDb } from "../db"

const idOf = async (key: string) =>
  (
    await getDb().select({ id: media.id }).from(media).where(eq(media.key, key))
  )[0].id

const usagesOf = (entityType: string, entityId: string) =>
  getDb()
    .select({ mediaId: mediaUsages.mediaId, field: mediaUsages.field })
    .from(mediaUsages)
    .where(
      and(
        eq(mediaUsages.entityType, entityType),
        eq(mediaUsages.entityId, entityId)
      )
    )

beforeAll(async () => {
  await resetDb()
  await seedContent(getDb())
})

describe("media_usages backfill (ledger carry: seeded refs)", () => {
  it("covers page, settings and service JSON", async () => {
    expect(await usagesOf("page", "home")).toContainEqual({
      mediaId: await idOf("/images/hero.jpg"),
      field: "hero.backgroundImage",
    })
    expect(
      (await usagesOf("settings", "site")).map((u) => u.mediaId)
    ).toContain(await idOf("/images/logo.png"))
    const serviceUsages = await getDb()
      .select({ id: mediaUsages.id })
      .from(mediaUsages)
      .where(eq(mediaUsages.entityType, "service"))
    expect(serviceUsages.length).toBeGreaterThan(0)
  })

  it("covers team photo, client and group company logos (FK columns)", async () => {
    const [client] = await getDb()
      .select()
      .from(clients)
      .where(eq(clients.name, "Dinn Rí"))
    expect(await usagesOf("client", client.id)).toEqual([
      { mediaId: client.logoId, field: "logo" },
    ])
    const [group] = await getDb().select().from(groupCompanies).limit(1)
    expect(await usagesOf("groupCompany", group.id)).toEqual([
      { mediaId: group.logoId, field: "logo" },
    ])
    for (const member of await getDb().select().from(teamMembers))
      expect(await usagesOf("team", member.id)).toEqual(
        member.photoId ? [{ mediaId: member.photoId, field: "photo" }] : []
      )
  })

  it("covers rich-text image attrs.media and is idempotent", async () => {
    const [article] = await getDb().select().from(articles).limit(1)
    const bannerId = await idOf("/images/banner.png")
    const draft = {
      ...(article.draft as Record<string, unknown>),
      body: {
        type: "doc",
        content: [
          { type: "image", attrs: { media: { mediaId: bannerId }, alt: "" } },
        ],
      },
    }
    await getDb()
      .update(articles)
      .set({ draft: draft as typeof article.draft })
      .where(eq(articles.id, article.id))
    const first = await backfillMediaUsages(getDb())
    const second = await backfillMediaUsages(getDb())
    expect(second).toBe(first)
    expect(await usagesOf("article", article.id)).toContainEqual({
      mediaId: bannerId,
      field: "body.content.0.attrs.media",
    })
  })
})
