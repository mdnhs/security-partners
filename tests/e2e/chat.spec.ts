import {
  type Browser,
  expect,
  type Page,
  type Response,
  test,
} from "@playwright/test"

import { CHAT_SETTINGS_DEFAULT } from "@/lib/chat/defaults"
import { CHAT_PUBLIC_ENDPOINT } from "@/lib/schemas/api/chat"

import { E2E_OWNER } from "./admin-accounts"
import { BASE_URL } from "./env"
import { clientIpFor, E2E_PASSWORD, waitForHydration } from "./fixtures"

// Live chat plan Task 12: a visitor chats on the public site, the owner
// replies from Live chat (which takes the chat over), the visitor sees it,
// the owner closes it. Chat is off by default: beforeAll turns it on (AI
// assistant off), the last test turns it off again and checks nothing of
// the widget reaches the page.

const SAME_ORIGIN = { origin: BASE_URL }
const { copy, hint } = CHAT_SETTINGS_DEFAULT
const QUESTION = "Do you clean offices in Tullamore?"
const REPLY = "Yes, we do. Call 057 8697670."
/** Chats this spec started, deleted in afterAll. */
const chatIds: string[] = []

async function signIn(page: Page, email: string) {
  await page.goto("/admin/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL((url) => url.pathname === "/admin")
}

/** A signed-in owner page in its own context; close the context after. */
async function ownerPage(browser: Browser, tag: string) {
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": clientIpFor(tag) },
  })
  const page = await context.newPage()
  await signIn(page, E2E_OWNER.email)
  return { context, page }
}

async function publishChat(page: Page, enabled: boolean) {
  type Dto = {
    draft: Record<string, unknown> | null
    published: Record<string, unknown> | null
    version: number
  }
  const dto = (await (
    await page.request.get("/api/v1/admin/settings/chat")
  ).json()) as Dto
  const current = dto.draft ?? dto.published ?? {}
  const saved = await page.request.put("/api/v1/admin/settings/chat/draft", {
    headers: SAME_ORIGIN,
    data: {
      version: dto.version,
      draft: {
        ...current,
        enabled,
        bot: { ...(current.bot as object), enabled: false },
      },
    },
  })
  expect(saved.status()).toBe(200)
  const { version } = (await saved.json()) as { version: number }
  const published = await page.request.post(
    "/api/v1/admin/settings/chat/publish",
    { headers: SAME_ORIGIN, data: { version } }
  )
  expect(published.status()).toBe(200)
}

/** Script responses the page loads; read their text with chatScripts. */
function recordScripts(page: Page): Response[] {
  const scripts: Response[] = []
  page.on("response", (res) => {
    if (res.request().resourceType() === "script") scripts.push(res)
  })
  return scripts
}

/** URLs of loaded scripts that hold widget code (they call the chat API). */
async function chatScripts(scripts: Response[]): Promise<string[]> {
  const hits: string[] = []
  for (const res of scripts) {
    const body = await res.text().catch(() => "")
    if (body.includes(CHAT_PUBLIC_ENDPOINT)) hits.push(res.url())
  }
  return hits
}

test.describe.serial("live chat", () => {
  test.beforeAll(async ({ browser }) => {
    const { context, page } = await ownerPage(browser, "chat beforeAll")
    await publishChat(page, true)
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    // Leave chat off and the database without this spec's chats, even when
    // a test failed before the last one turned it off.
    const { context, page } = await ownerPage(browser, "chat afterAll")
    await publishChat(page, false)
    for (const id of chatIds) {
      const res = await page.request.delete(`/api/v1/admin/chat/${id}`, {
        headers: SAME_ORIGIN,
      })
      expect([200, 404]).toContain(res.status())
    }
    await context.close()
  })

  test("visitor chats, staff replies and takes over, visitor sees it", async ({
    browser,
  }, testInfo) => {
    const visitorContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      extraHTTPHeaders: { "x-forwarded-for": clientIpFor(testInfo.title) },
    })
    const owner = await ownerPage(browser, `${testInfo.title} owner`)
    try {
      const visitor = await visitorContext.newPage()
      const scripts = recordScripts(visitor)
      await visitor.goto("/")
      await waitForHydration(visitor)
      const launcher = visitor.getByRole("button", {
        name: copy.launcherOpen,
        exact: true,
      })
      await launcher.click()
      // Control for the "chat off" check: with chat on, the page loads
      // widget code that calls the chat API.
      expect(await chatScripts(scripts)).not.toEqual([])

      const panel = visitor.getByRole("dialog", { name: copy.title })
      await expect(panel).toBeVisible()
      const started = visitor.waitForResponse(
        (res) =>
          res.url().endsWith(`${CHAT_PUBLIC_ENDPOINT}/start`) &&
          res.request().method() === "POST"
      )
      const composer = panel.getByRole("textbox", { name: copy.messageLabel })
      await composer.fill(QUESTION)
      await composer.press("Enter")
      const start = await started
      expect(start.status()).toBe(201)
      chatIds.push(((await start.json()) as { id: string }).id)
      const log = panel.getByRole("log", { name: copy.conversation })
      await expect(log.getByText(QUESTION)).toBeVisible()

      // The owner finds the new chat at the top of Live chat and replies.
      const admin = owner.page
      await admin.goto("/admin/chat")
      const rows = admin
        .getByRole("region", { name: "Chats" })
        .getByRole("listitem")
        .getByRole("button")
      await expect(rows.first()).toBeVisible()
      await rows.first().click()
      await admin.waitForURL((url) => url.searchParams.get("c") === chatIds[0])
      const thread = admin.getByRole("region", { name: "Conversation" })
      await expect(thread.getByText(QUESTION)).toBeVisible()
      const reply = thread.getByRole("textbox", { name: "Reply" })
      await reply.fill(REPLY)
      await reply.press("Enter")
      await expect(thread.getByText("Call 057 8697670")).toBeVisible()

      // The visitor's poll (3 s while open) brings the reply and the agent.
      const phone = log.getByRole("link", { name: "057 8697670" })
      await expect(phone).toBeVisible({ timeout: 5000 })
      await expect(phone).toHaveAttribute("href", "tel:+353578697670")
      await expect(log).toContainText(REPLY)
      await expect(
        panel.getByText(`Chatting with ${E2E_OWNER.name}`)
      ).toBeVisible()

      // The owner closes the chat; the visitor is offered a new one.
      await thread.getByRole("button", { name: "Close", exact: true }).click()
      await expect(reply).toHaveCount(0)
      await expect(
        panel.getByRole("button", { name: copy.startNew })
      ).toBeVisible({ timeout: 10_000 })
    } finally {
      await owner.context.close()
      await visitorContext.close()
    }
  })

  test("a hint preset is sent at once", async ({ page }, testInfo) => {
    await page.context().setExtraHTTPHeaders({
      "x-forwarded-for": clientIpFor(testInfo.title),
    })
    await page.goto("/")
    await waitForHydration(page)
    const tray = page.getByRole("group", { name: copy.hintGroup })
    await expect(tray).toBeVisible()
    await tray.hover()
    const preset = hint.presets[0]!
    const started = page.waitForResponse(
      (res) =>
        res.url().endsWith(`${CHAT_PUBLIC_ENDPOINT}/start`) &&
        res.request().method() === "POST"
    )
    await tray.getByRole("button", { name: preset.label }).click()
    const start = await started
    expect(start.status()).toBe(201)
    chatIds.push(((await start.json()) as { id: string }).id)
    expect(start.request().postDataJSON()).toMatchObject({
      message: preset.message,
    })
    const panel = page.getByRole("dialog", { name: copy.title })
    await expect(
      panel
        .getByRole("log", { name: copy.conversation })
        .getByText(preset.message)
    ).toBeVisible()
    await expect(
      panel.getByRole("textbox", { name: copy.messageLabel })
    ).toHaveValue("")
  })

  test("mobile: launcher clears the sticky CTA bar", async ({
    page,
  }, testInfo) => {
    await page.context().setExtraHTTPHeaders({
      "x-forwarded-for": clientIpFor(testInfo.title),
    })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/")
    await waitForHydration(page)
    const launcher = page.getByRole("button", {
      name: copy.launcherOpen,
      exact: true,
    })
    await expect(launcher).toBeVisible()
    await page.evaluate(() => {
      const hero = document.querySelector<HTMLElement>("[data-hero]")!
      window.scrollTo(0, hero.offsetTop + hero.offsetHeight + 200)
    })
    const bar = page.locator("[data-sticky-cta]")
    await expect(bar).toHaveAttribute("aria-hidden", "false")
    await expect
      .poll(async () => {
        const [l, b] = await Promise.all([
          launcher.boundingBox(),
          bar.boundingBox(),
        ])
        return !!l && !!b && b.y < 844 && l.y + l.height <= b.y
      })
      .toBe(true)
  })

  test("chat off: no launcher and /status is 404", async ({
    browser,
    page,
  }, testInfo) => {
    const owner = await ownerPage(browser, `${testInfo.title} owner`)
    try {
      await publishChat(owner.page, false)
    } finally {
      await owner.context.close()
    }
    await page.context().setExtraHTTPHeaders({
      "x-forwarded-for": clientIpFor(testInfo.title),
    })
    const scripts = recordScripts(page)
    await page.goto("/")
    await waitForHydration(page)
    await page.waitForTimeout(500)
    await expect(
      page.getByRole("button", { name: copy.launcherOpen })
    ).toHaveCount(0)
    await expect(page.getByRole("group", { name: copy.hintGroup })).toHaveCount(
      0
    )
    // No widget code is fetched: the launcher and panel chunks stay away.
    expect(await chatScripts(scripts)).toEqual([])
    const status = await page.request.get(`${CHAT_PUBLIC_ENDPOINT}/status`)
    expect(status.status()).toBe(404)
  })
})
