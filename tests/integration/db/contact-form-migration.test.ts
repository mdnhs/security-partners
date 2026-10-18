import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { eq, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import { revisions, settings } from "@/server/db/schema"

import { resetDb } from "../db"

const DIR = "server/db/migrations"
const file = readdirSync(DIR).find((f) =>
  f.endsWith("_contact_form_feedback.sql")
)!
const statements = readFileSync(join(DIR, file), "utf8")
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean)

const OLD_FORM = {
  nameLabel: "Your Name",
  namePlaceholder: "John Smith",
  emailLabel: "Email",
  emailPlaceholder: "you@company.ie",
  phoneLabel: "Phone",
  phonePlaceholder: "085 000 0000",
  messageLabel: "Message",
  messagePlaceholder: "Tell us",
  submitLabel: "Send Message",
  mailtoSubject: "Website enquiry from {name}",
}

beforeEach(async () => {
  await resetDb()
})

describe("0007_contact_form_feedback (custom data migration)", () => {
  it("adds the feedback copy to draft, published and revisions without overwriting edits", async () => {
    const db = getDb()
    await db.insert(settings).values({
      key: "sections.contact",
      draft: { heading: "Contact", form: OLD_FORM },
      published: {
        heading: "Contact",
        form: { ...OLD_FORM, successMessage: "Edited by the owner" },
      },
      version: 3,
    })
    await db.insert(revisions).values({
      entityType: "settings",
      entityId: "sections.contact",
      version: 2,
      data: { heading: "Contact", form: OLD_FORM },
    })
    for (const statement of statements) await db.execute(sql.raw(statement))

    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "sections.contact"))
    const draft = row.draft as { form: Record<string, string> }
    const published = row.published as { form: Record<string, string> }
    expect(draft.form).toMatchObject({
      ...OLD_FORM,
      sendingLabel: "Sending…",
      successMessage:
        "Thank you, your message has been sent. We will be in touch shortly.",
      errorMessage:
        "Sorry, your message could not be sent. Please try again or call us.",
      rateLimitedMessage:
        "You have sent several messages in a short time. Please wait a few minutes and try again.",
    })
    expect(published.form.successMessage).toBe("Edited by the owner")
    expect(published.form.sendingLabel).toBe("Sending…")
    const [revision] = await db.select().from(revisions)
    expect(
      (revision.data as { form: Record<string, string> }).form.errorMessage
    ).toBe(
      "Sorry, your message could not be sent. Please try again or call us."
    )
  })

  it("is a no-op when the row does not exist", async () => {
    for (const statement of statements)
      await getDb().execute(sql.raw(statement))
    expect(await getDb().select().from(settings)).toHaveLength(0)
  })
})
