import { expect, type Page } from "@playwright/test"

/**
 * The AI assistant, pinned (Phase 9) for the visual and axe matrices. The
 * seeded databases have no `integrations.ai` row, so the panel layout says
 * "off" and the topbar shows no button (every other baseline unchanged).
 * Saving an integration refetches the assistant status, which is pinned
 * "on" here; the chat answers with a pinned NDJSON stream. No request ever
 * reaches an AI provider.
 */
export const AI_ON = {
  available: true,
  model: "claude-sonnet-5-5",
  readOnly: false,
}

export const AI_REPLY =
  "“Round-the-clock security for Irish businesses”\n\nShorter and names who it is for. Two more options:\n• Security that never clocks off\n• Guarding Ireland’s businesses, day and night"

const ndjson = (...events: unknown[]) =>
  events.map((event) => `${JSON.stringify(event)}\n`).join("")

const CONVERSATION_ID = "0190f0e0-0000-7000-8000-0000000000e1"

const CONVERSATIONS = {
  items: [
    {
      id: CONVERSATION_ID,
      title: "Make the hero heading shorter",
      createdAt: "2026-10-16T09:00:00.000Z",
      updatedAt: "2026-10-16T09:00:05.000Z",
    },
    {
      id: "0190f0e0-0000-7000-8000-0000000000e2",
      title: "SEO description for Services",
      createdAt: "2026-10-15T14:00:00.000Z",
      updatedAt: "2026-10-15T14:02:00.000Z",
    },
  ],
  page: 1,
  pageSize: 20,
  total: 2,
}

/** Status "on", the chat stream and the conversation list. */
export async function pinAssistant(page: Page) {
  await page.route("**/api/v1/admin/ai/status", (route) =>
    route.fulfill({ json: AI_ON })
  )
  await page.route("**/api/v1/admin/ai/chat", (route) =>
    route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-store",
      },
      body: ndjson(
        { type: "start", conversationId: CONVERSATION_ID },
        { type: "text", text: AI_REPLY.slice(0, 40) },
        { type: "text", text: AI_REPLY.slice(40) },
        { type: "done", messageId: "0190f0e0-0000-7000-8000-0000000000e3" }
      ),
    })
  )
  await page.route("**/api/v1/admin/ai/conversations*", (route) =>
    route.fulfill({ json: CONVERSATIONS })
  )
}

/**
 * Turns the assistant on the way Settings does (signed in, any page): a
 * pinned SMTP save refetches the status, the button appears; then ⌘K
 * "Edit the home page" (a client navigation: the shell, the button and the
 * status stay) and the hero's first text field is focused.
 */
export async function assistantOnHomeEditor(
  page: Page,
  savedSmtp: { version: number; values: { host: string } }
) {
  await pinAssistant(page)
  await page.route("**/api/v1/admin/integrations/integrations.smtp", (route) =>
    route.fulfill({
      json:
        route.request().method() === "PUT"
          ? { ...savedSmtp, version: savedSmtp.version + 1 }
          : savedSmtp,
    })
  )
  await page.goto("/admin/settings/integrations/smtp")
  const host = page.getByLabel("SMTP server")
  await expect(host).toHaveValue(savedSmtp.values.host)
  await host.fill(`mail.${savedSmtp.values.host}`)
  await page.getByRole("button", { name: "Save", exact: true }).click()
  const button = page.getByRole("button", { name: "AI assistant" })
  await expect(button).toBeVisible()

  await page.getByRole("button", { name: "Search" }).click()
  await page
    .getByRole("dialog", { name: "Search the admin" })
    .getByRole("option", { name: "Edit the home page" })
    .click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Home" })
  ).toBeVisible()
  await expect(page.getByRole("status", { name: /^Save status/ })).toHaveText(
    /Saved/
  )
  const field = page
    .getByRole("region", { name: "Hero" })
    .getByRole("textbox")
    .first()
  await field.focus()
  // The "Saved" toast from Settings has gone.
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, {
    timeout: 10_000,
  })
  return { button, field }
}

/** Opens the panel (⌘J would do the same) and waits for the composer. */
export async function openAssistant(page: Page) {
  await page.getByRole("button", { name: "AI assistant" }).click()
  const panel = page.getByRole("dialog", { name: "AI assistant" })
  await expect(
    panel.getByRole("textbox", { name: "Message the AI assistant" })
  ).toBeFocused()
  return panel
}

/** Sends one message and waits for the pinned reply to finish. */
export async function askAssistant(
  page: Page,
  panel = page.getByRole("dialog", { name: "AI assistant" })
) {
  await panel
    .getByRole("textbox", { name: "Message the AI assistant" })
    .fill("Make the hero heading shorter")
  await page.keyboard.press("Enter")
  await expect(panel.getByRole("button", { name: "Copy" })).toBeVisible()
  await expect(panel.getByRole("button", { name: "Send" })).toBeVisible()
}
