import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { eq, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { careersSettings } from "@/lib/schemas/settings/careers"
import { getDb } from "@/server/db/client"
import { pages, settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { careersTemplate } from "@/templates/careers/schema"

import { resetDb } from "../db"

const DIR = "server/db/migrations"
const file = readdirSync(DIR).find((f) => f.endsWith("_careers_talent_pool.sql"))!
const statements = readFileSync(join(DIR, file), "utf8")
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean)

async function migrate() {
  for (const statement of statements) await getDb().execute(sql.raw(statement))
}

const OLD_CONSENT =
  "Keep my details on file for 12 months and contact me about future roles."
const OLD_DATA =
  "We only use your details for recruitment. Unsuccessful applications are deleted after 12 months unless you ask us to keep them, in line with GDPR."
const OLD_HREF = "mailto:HR@securitypartnersltd.com"

type Careers = ReturnType<typeof careersTemplate.parse>
const careersRow = async () =>
  (await getDb().select().from(pages).where(eq(pages.key, "careers")))[0]

/** The careers page and settings as 0022 left them. */
async function before0025(patch: (d: Careers) => Careers = (d) => d) {
  await seedContent(getDb())
  const row = await careersRow()
  const old = (value: unknown) => {
    const d = value as Careers
    return patch({
      ...d,
      cta: { ...d.cta, primary: { ...d.cta.primary, href: OLD_HREF } },
      apply: {
        ...d.apply,
        consents: [d.apply.consents[0], d.apply.consents[1], OLD_CONSENT],
        sidebar: { ...d.apply.sidebar, dataCopy: OLD_DATA },
      },
    })
  }
  await getDb()
    .update(pages)
    .set({ draft: old(row.draft), published: old(row.published) })
    .where(eq(pages.key, "careers"))
  const legacy = { recipients: ["HR@securitypartnersltd.com"], retentionMonths: 12 }
  await getDb()
    .update(settings)
    .set({ draft: legacy, published: legacy })
    .where(eq(settings.key, "careers"))
}

beforeEach(resetDb)

describe("careers_talent_pool (data migration 0025)", () => {
  it("points Send Us Your CV at the talent pool form and fills the retention placeholders", async () => {
    await before0025()
    await migrate()
    const row = await careersRow()
    for (const value of [row.draft, row.published]) {
      const d = careersTemplate.parse(value)
      expect(d.cta.primary.href).toBe("/careers/apply")
      expect(d.apply.consents[2]).toContain("{keepMonths} months")
      expect(d.apply.sidebar.dataCopy).toContain("after {months} months")
    }
    const [s] = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.key, "careers"))
    for (const value of [s.draft, s.published])
      expect(careersSettings.parse(value)).toMatchObject({
        retentionMonths: 12,
        keepOnFileMonths: 24,
      })
  })

  it("leaves copy an admin already changed alone, and is idempotent", async () => {
    await before0025((d) => ({
      ...d,
      cta: { ...d.cta, primary: { ...d.cta.primary, href: "/contact" } },
    }))
    await migrate()
    await migrate()
    const d = careersTemplate.parse((await careersRow()).published)
    expect(d.cta.primary.href).toBe("/contact")
    expect(d.apply.consents[2]).toContain("{keepMonths}")
  })
})
