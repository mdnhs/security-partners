import { createHash, createHmac, hkdfSync, randomBytes } from "node:crypto"

import { type APIRequestContext, expect, test } from "@playwright/test"
import { Client } from "pg"

import type { SubscriberDto } from "@/lib/schemas/api/newsletter"

import { E2E_OWNER } from "./admin-accounts"
import { BASE_URL, E2E_ENV } from "./env"
import { clientIpFor, E2E_PASSWORD } from "./fixtures"

// D4.2: with placement "blog" published, a visitor subscribes on /blog,
// confirms, and unsubscribes through the button page; ruling 2 (seeded
// "off") is restored afterwards so the visual suite stays at 0 px.
//
// The confirmation email is not read from Mailpit: the E2E server is the
// production server.js, whose SMTP guard refuses the loopback Mailpit (see
// leads.spec.ts). Mail delivery is covered by
// tests/integration/api/newsletter.test.ts. Here the spec plants a known
// confirm token (only its sha256 is stored) and derives the unsubscribe
// token the email would carry (HKDF "newsletter" from the E2E secret).

test.describe.configure({ mode: "serial" })

const VISITOR = `newsletter-${Date.now()}@example.test`
const SETTINGS = "/api/v1/admin/settings/newsletter"

type SettingsEntry = {
  version: number
  draft: Record<string, unknown> | null
  published: Record<string, unknown> | null
}

type PlaywrightRequest = {
  request: { newContext: (typeof import("@playwright/test"))["request"]["newContext"] }
}

async function ownerApi(
  playwright: PlaywrightRequest
): Promise<APIRequestContext> {
  // Origin: the admin API's CSRF guard (sameOrigin) checks unsafe methods.
  const api = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      origin: BASE_URL,
      "x-forwarded-for": clientIpFor(`newsletter owner ${VISITOR}`),
    },
  })
  const signIn = await api.post("/api/auth/sign-in/email", {
    data: { email: E2E_OWNER.email, password: E2E_PASSWORD },
  })
  expect(signIn.ok()).toBe(true)
  return api
}

async function publishPlacement(
  api: APIRequestContext,
  placement: "off" | "blog"
) {
  const current = await api.get(SETTINGS)
  expect(current.ok()).toBe(true)
  const entry = (await current.json()) as SettingsEntry
  const base = entry.draft ?? entry.published ?? {}
  const saved = await api.put(`${SETTINGS}/draft`, {
    data: { version: entry.version, draft: { ...base, placement } },
  })
  expect(saved.ok()).toBe(true)
  const { version } = (await saved.json()) as SettingsEntry
  expect((await api.post(`${SETTINGS}/publish`, { data: { version } })).ok()).toBe(
    true
  )
}

/** The unsubscribe token the confirmation email carries (server/modules/newsletter/service.ts). */
function unsubscribeToken(id: string): string {
  const key = Buffer.from(
    hkdfSync("sha256", E2E_ENV.BETTER_AUTH_SECRET, "sp/v1", "newsletter", 32)
  )
  const mac = createHmac("sha256", key)
    .update(`unsubscribe:${id}`)
    .digest("base64url")
  return `${id}.${mac.slice(0, 32)}`
}

async function findSubscriber(
  api: APIRequestContext
): Promise<SubscriberDto | undefined> {
  const res = await api.get(
    `/api/v1/admin/newsletter?q=${encodeURIComponent(VISITOR)}`
  )
  expect(res.ok()).toBe(true)
  const { items } = (await res.json()) as { items: SubscriberDto[] }
  return items.find((item) => item.email === VISITOR)
}

test.afterAll(async ({ playwright }) => {
  const api = await ownerApi(playwright)
  const subscriber = await findSubscriber(api)
  if (subscriber)
    await api.delete(`/api/v1/admin/newsletter/${subscriber.id}`)
  await publishPlacement(api, "off")
  await api.dispose()
})

test("off by default: /blog has no signup form", async ({ page }) => {
  await page.goto("/blog")
  await expect(page.locator("#newsletter")).toHaveCount(0)
})

test("placement blog → subscribe, confirm, unsubscribe", async ({
  page,
  playwright,
}) => {
  const api = await ownerApi(playwright)
  await publishPlacement(api, "blog")

  await page.context().setExtraHTTPHeaders({
    "x-forwarded-for": clientIpFor(`newsletter visitor ${VISITOR}`),
  })
  await page.goto("/blog")
  const section = page.getByRole("region", {
    name: "Security insights in your inbox",
  })
  await section.getByLabel("Email address").fill(VISITOR)
  await section.getByRole("button", { name: "Subscribe" }).click()
  await expect(section.getByRole("status")).toHaveText(
    "Check your inbox to confirm your subscription."
  )

  const pending = await findSubscriber(api)
  expect(pending?.status).toBe("pending")

  // Plant a known confirm token (the email's link is not reachable here).
  const token = randomBytes(32).toString("base64url")
  const db = new Client({ connectionString: E2E_ENV.DATABASE_URL })
  await db.connect()
  try {
    await db.query(
      "update newsletter_subscribers set token_hash = $1 where email = $2",
      [createHash("sha256").update(token).digest("hex"), VISITOR]
    )
  } finally {
    await db.end()
  }
  await page.goto(`/api/v1/public/newsletter/confirm?token=${token}`)
  await expect(page).toHaveURL(/\/newsletter\/confirmed$/)
  await expect(
    page.getByRole("heading", { level: 1, name: "You're subscribed" })
  ).toBeVisible()
  // Single use: the same link is now invalid.
  await page.goto(`/api/v1/public/newsletter/confirm?token=${token}`)
  await expect(page).toHaveURL(/\/newsletter\/invalid$/)

  const confirmed = await findSubscriber(api)
  expect(confirmed?.status).toBe("confirmed")

  await page.goto(
    `/newsletter/unsubscribe?token=${encodeURIComponent(unsubscribeToken(confirmed!.id))}`
  )
  await page.getByRole("button", { name: "Unsubscribe" }).click()
  await expect(page).toHaveURL(/\/newsletter\/unsubscribed$/)
  await expect(
    page.getByRole("heading", { level: 1, name: "You're unsubscribed" })
  ).toBeVisible()
  expect((await findSubscriber(api))?.status).toBe("unsubscribed")
  await api.dispose()
})

test("state pages: noindex, no referrer; unknown states are a real 404", async ({
  page,
}) => {
  const res = await page.goto("/newsletter/confirmed")
  expect(res?.status()).toBe(200)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/
  )
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute(
    "content",
    "no-referrer"
  )
  expect((await page.goto("/newsletter/nope"))?.status()).toBe(404)
})
