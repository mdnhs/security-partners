import { and, eq, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type { PreferredAddressDto } from "@/lib/schemas/api/seo"
import { getDb } from "@/server/db/client"
import { auditLog, settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import {
  getHostPolicy,
  resetHostPolicyCache,
} from "@/server/modules/seo/preferred-host"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let editor: string
let viewer: string

/** settings.site.productionUrl, published (the seed leaves it unset). */
async function setProductionUrl(url: string | null) {
  await getDb()
    .update(settings)
    .set({
      published: sql`${settings.published} || ${JSON.stringify({ productionUrl: url })}::jsonb`,
    })
    .where(eq(settings.key, "site"))
}

async function row() {
  const [r] = await getDb()
    .select()
    .from(settings)
    .where(eq(settings.key, "seo.defaults"))
  return r!
}

const put = (cookie: string, preferredHost: string) =>
  adminRequest("/seo/preferred-address", {
    cookie,
    method: "PUT",
    json: { preferredHost },
  })

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  resetHostPolicyCache()
  editor = (await signedInUser(["editor"])).cookie
  viewer = (await signedInUser(["viewer"])).cookie
})

describe("/seo/preferred-address", () => {
  it("reads the live choice and the site's host", async () => {
    await setProductionUrl("https://www.cleaningpartners.ie")
    const res = await adminRequest("/seo/preferred-address", { cookie: viewer })
    expect(res.status).toBe(200)
    expect((await res.json()) as PreferredAddressDto).toEqual({
      preferredHost: "off",
      siteHost: "cleaningpartners.ie",
    })
  })

  it("saves live: draft and published both change, the proxy policy follows, and it is audited", async () => {
    await setProductionUrl("https://cleaningpartners.ie")
    const before = await row()
    const res = await put(editor, "apex")
    expect(res.status, await res.clone().text()).toBe(200)
    expect(await res.json()).toEqual({
      preferredHost: "apex",
      siteHost: "cleaningpartners.ie",
    })
    const after = await row()
    expect((after.published as { preferredHost: string }).preferredHost).toBe(
      "apex"
    )
    expect((after.draft as { preferredHost: string }).preferredHost).toBe(
      "apex"
    )
    // Everything else stays as it was.
    expect((after.published as { title: string }).title).toBe(
      (before.published as { title: string }).title
    )
    expect(after.version).toBe(before.version + 1)
    expect(await getHostPolicy()).toEqual({
      preferred: "apex",
      siteHost: "cleaningpartners.ie",
    })
    const audits = await getDb()
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, "seo.preferred_address_updated"),
          eq(auditLog.entityId, "seo.defaults")
        )
      )
    expect(audits).toHaveLength(1)
  })

  it("refuses www/apex while the production URL is unset; off is always fine", async () => {
    await setProductionUrl(null)
    const res = await put(editor, "www")
    expect(res.status).toBe(422)
    expect((await put(editor, "off")).status).toBe(200)
  })

  it("a viewer may read but not save; a bad value is a 422", async () => {
    await setProductionUrl("https://cleaningpartners.ie")
    expect((await put(viewer, "apex")).status).toBe(403)
    expect((await put(editor, "both")).status).toBe(422)
  })
})
