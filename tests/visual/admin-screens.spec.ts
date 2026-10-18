import { expect, type Page, test } from "@playwright/test"

import { clientIpFor } from "../e2e/fixtures"

import { VISUAL_ADMIN, VISUAL_AUTHOR, VISUAL_EDITOR } from "./admin-user"

// JW parity baselines (phase-04b Task 12): every Phase 4 admin screen in
// light and dark, desktop and phone. Relative times and the time-of-day
// greeting are masked; the dashboard's numbers and the audit log are pinned
// with page.route (real entries change with every sign-in); charts skip
// their grow-in under reduced motion.

test.use({ reducedMotion: "reduce" })

test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": clientIpFor(
      `visual ${testInfo.title} ${testInfo.project.name}`
    ),
  })
})

const DASHBOARD = {
  kpis: {
    leads30d: 7,
    openLeads: 3,
    published: { pages: 8, services: 6, articles: 8 },
    inReview: 2,
  },
  leadsTrend: Array.from({ length: 90 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 6, 19 + i)).toISOString().slice(0, 10),
    count: [0, 1, 0, 2, 1, 0, 3][i % 7]!,
  })),
  nextUp: [
    {
      id: "smtp",
      title: "Set up email (SMTP)",
      description: "So enquiries and invitations reach people.",
      href: "/admin/settings/integrations/smtp",
      done: false,
    },
    {
      id: "two-factor",
      title: "Turn on two-factor authentication",
      description: "Protect the owner and admin accounts.",
      href: "/admin/account?tab=security",
      done: true,
    },
  ],
}

const AUDIT = {
  items: ["page.published", "settings.draft_saved", "auth.sign_in"].map(
    (action, i) => ({
      id: `a${i}`,
      action,
      entityType: action.startsWith("page")
        ? "page"
        : action.startsWith("settings")
          ? "settings"
          : null,
      entityId: action.startsWith("page")
        ? "home"
        : action.startsWith("settings")
          ? "footer"
          : null,
      actor: { id: "u1", name: "Vera Visual", email: VISUAL_ADMIN.email },
      impersonatorId: null,
      ip: "198.18.0.1",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
      diff:
        action === "settings.draft_saved"
          ? { from: { phone: "01 234 5678" }, to: { phone: "01 234 9999" } }
          : null,
      createdAt: "2026-10-16T09:00:00Z",
    })
  ),
  page: 1,
  pageSize: 6,
  total: 3,
}

/**
 * The review queue, pinned (Phase 5): the seed publishes every article, so
 * two drafts awaiting review are served for the ?status=in_review shot;
 * the unfiltered list and the options come from the seed.
 */
const REVIEW_QUEUE = {
  items: ["Night Patrols Explained", "Choosing a Key Holding Partner"].map(
    (title, i) => ({
      id: `0190f0e0-0000-7000-8000-0000000000a${i}`,
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      title,
      live: false,
      category: { id: "c1", slug: "mobile-patrols", name: "Mobile Patrols" },
      author: { id: "u2", name: "Arthur Author", title: "Security writer" },
      scheduledAt: null,
      readTimeMinutes: null,
      createdAt: "2026-10-16T09:00:00Z",
      permissions: {
        update: true,
        delete: true,
        submit: false,
        publish: true,
        changeAuthor: true,
      },
      version: 2,
      status: "in_review",
      dirty: true,
      publishedAt: null,
      updatedAt: "2026-10-16T09:00:00Z",
      updatedBy: { id: "u2", name: "Arthur Author" },
    })
  ),
  page: 1,
  pageSize: 20,
  total: 2,
}

/** The dashboard's numbers and the audit log, pinned. */
async function pinData(page: Page) {
  await page.route("**/api/v1/admin/dashboard", (route) =>
    route.fulfill({ json: DASHBOARD })
  )
  await page.route("**/api/v1/admin/audit*", (route) =>
    route.fulfill({ json: AUDIT })
  )
}

async function signIn(
  page: Page,
  who: { email: string; password: string } = VISUAL_ADMIN
) {
  await page.goto("/admin/sign-in")
  await page.getByLabel("Email").fill(who.email)
  await page.getByLabel("Password", { exact: true }).fill(who.password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.getByTestId("greeting")).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

/**
 * Overlays (sheets, the palette): the page behind is hidden with CSS, as a
 * mask painted at a masked element's position would show through the
 * overlay; only the sidebar's host line still needs masking.
 */
async function overlayOnly(page: Page) {
  await page.addStyleTag({
    content: `${STABLE_CSS} main#main { visibility: hidden }`,
  })
  return [page.locator('[data-slot="website-host"]')]
}

/**
 * A mask covers the masked element's box, and the box follows the text: a
 * relative time ("3 minutes ago" / "an hour ago"), the time-of-day
 * greeting, the host and a session's sign-in line all change length from
 * run to run. They are boxed to a fixed width first, so the mask is the
 * same size every time.
 */
const STABLE_CSS = `
  time, [data-testid="greeting"], [data-slot="website-host"],
  [aria-label="Signed-in devices"] li > div > span:last-child {
    display: inline-block; max-width: 100%; overflow: hidden;
    white-space: nowrap; vertical-align: bottom;
  }
  time { width: 9rem }
  [data-testid="greeting"] { width: 20rem }
  [data-slot="website-host"] { width: 12rem }
  [aria-label="Signed-in devices"] li > div > span:last-child { width: 18rem }
`

async function masks(page: Page) {
  await page.addStyleTag({ content: STABLE_CSS })
  return [
    page.locator("time"),
    page.getByTestId("greeting"),
    page.locator('[data-slot="website-host"]'),
    page
      .getByRole("list", { name: "Signed-in devices" })
      .locator("li > div > span:last-child"),
  ]
}

/** The editor has loaded and settled (autosave idle). */
async function editorReady(page: Page, title: string) {
  await expect(
    page.getByRole("heading", { level: 1, name: title })
  ).toBeVisible()
  await expect(page.getByRole("status", { name: /^Save status/ })).toHaveText(
    /Saved/
  )
  await page.evaluate(() => document.fonts.ready)
}

/** Pinned dates and rights for the article editor shots (Phase 5). */
const ARTICLE_TIMES = {
  createdAt: "2026-10-12T09:00:00.000Z",
  updatedAt: "2026-10-16T09:00:00.000Z",
}
const AUTHOR_RIGHTS = {
  update: true,
  delete: true,
  submit: true,
  publish: false,
  changeAuthor: false,
}
const EDITOR_RIGHTS = {
  update: true,
  delete: true,
  submit: true,
  publish: true,
  changeAuthor: true,
}

/**
 * Opens a seeded article in the editor with its state pinned: the API's
 * record (seeded content, real cover image) with the workflow fields
 * replaced, so the shot shows a draft / review / schedule whatever the seed
 * published, and the dates never change.
 */
async function openArticle(
  page: Page,
  slug: string,
  state: Record<string, unknown>
) {
  const list = await page.request.get(
    `/api/v1/admin/articles?q=${encodeURIComponent(slug)}`
  )
  const { items } = (await list.json()) as {
    items: { id: string; slug: string; title: string }[]
  }
  const article = items.find((a) => a.slug === slug)!
  await page.route(`**/api/v1/admin/articles/${article.id}`, async (route) => {
    if (route.request().method() !== "GET") return route.continue()
    const response = await route.fetch()
    const record = (await response.json()) as Record<string, unknown>
    await route.fulfill({
      json: { ...record, ...ARTICLE_TIMES, ...state },
    })
  })
  await page.goto(`/admin/articles/${article.id}`)
  return article
}

/** The article editor has loaded (read-only ones have no save state). */
async function articleReady(page: Page, title: string, editable = true) {
  if (editable) await editorReady(page, title)
  else {
    await expect(
      page.getByRole("heading", { level: 1, name: title })
    ).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
  }
  await expect(page.getByLabel("Category", { exact: true })).toBeVisible()
  // The cover thumbnail and the word count have rendered.
  await expect(
    page.getByText(/words · about \d+ min read|No text yet/)
  ).toBeVisible()
}

/**
 * Settings ▸ Integrations, pinned (Phase 6): SMTP saved (with a passed
 * test), R2 never set up; the overview lists both plus the two others.
 */
const INTEGRATION_BASE = {
  updatedAt: "2026-10-16T09:00:00.000Z",
  updatedBy: { id: "u1", name: "Vera Visual" },
}
const SMTP_SAVED = {
  key: "integrations.smtp",
  slug: "smtp",
  label: "Email (SMTP)",
  description: "Sends invitations, password resets and enquiry notifications.",
  configured: true,
  version: 2,
  values: {
    host: "smtp.example.ie",
    port: 587,
    secure: false,
    user: "mailer@example.ie",
    fromName: "Security Partners",
    fromAddress: "no-reply@example.ie",
  },
  secrets: { password: { set: true, hint: "••••1234" } },
  ...INTEGRATION_BASE,
}
const R2_NEW = {
  key: "integrations.r2",
  slug: "r2",
  label: "Media storage (Cloudflare R2)",
  description:
    "Keeps uploaded images and documents. Until it is set up, uploads stay on the server disk.",
  configured: false,
  version: 0,
  values: { accountId: "", jurisdiction: "default", bucket: "" },
  secrets: {
    accessKeyId: { set: false, hint: null },
    secretAccessKey: { set: false, hint: null },
  },
  updatedAt: null,
  updatedBy: null,
}
const INTEGRATION_LIST = {
  items: [
    SMTP_SAVED,
    R2_NEW,
    {
      ...R2_NEW,
      key: "integrations.turnstile",
      slug: "turnstile",
      label: "Spam protection (Cloudflare Turnstile)",
      description: "An invisible check on the contact form.",
      values: { enabled: false, siteKey: "" },
      secrets: { secretKey: { set: false, hint: null } },
    },
    {
      ...R2_NEW,
      key: "integrations.ai",
      slug: "ai",
      label: "AI assistant",
      description: "Writing help in the admin for the roles you choose.",
      values: {},
      secrets: { apiKey: { set: false, hint: null } },
    },
  ],
}

async function pinIntegrations(page: Page) {
  await page.route("**/api/v1/admin/integrations", (route) =>
    route.fulfill({ json: INTEGRATION_LIST })
  )
  await page.route("**/api/v1/admin/integrations/integrations.smtp", (route) =>
    route.fulfill({ json: SMTP_SAVED })
  )
  await page.route(
    "**/api/v1/admin/integrations/integrations.smtp/test",
    (route) =>
      route.fulfill({
        json: {
          ok: true,
          message:
            "Connected to smtp.example.ie:587 and signed in as mailer@example.ie.",
          testedAt: "2026-10-16T09:00:00.000Z",
        },
      })
  )
  await page.route("**/api/v1/admin/integrations/integrations.r2", (route) =>
    route.fulfill({ json: R2_NEW })
  )
}

const PATROLS = "mobile-patrols-protect-your-business-after-hours"
const PATROLS_TITLE = "How Mobile Patrols Protect Your Business After Hours"

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme })

    const shot = (name: string) => `admin-${name}-${colorScheme}.png`

    test(`admin dashboard ${colorScheme}`, async ({ page }) => {
      await pinData(page)
      await signIn(page)
      await expect(
        page.getByRole("region", { name: "Team activity", exact: true })
      ).toContainText("published the home page")
      await expect(page).toHaveScreenshot(shot("dashboard"), {
        mask: await masks(page),
      })
    })

    test(`admin pages list ${colorScheme}`, async ({ page }) => {
      await signIn(page)
      await page.goto("/admin/pages")
      await expect(
        page.getByRole("heading", { level: 1, name: "Pages" })
      ).toBeVisible()
      await expect(
        page
          .getByRole("main")
          .getByRole("link", { name: "Home", exact: true })
          .first()
      ).toBeVisible()
      await expect(page).toHaveScreenshot(shot("pages"), {
        mask: await masks(page),
      })
    })

    test(`admin page editor ${colorScheme}`, async ({ page }) => {
      await signIn(page)
      await page.goto("/admin/pages/home")
      await editorReady(page, "Home")
      await expect(page).toHaveScreenshot(shot("page-editor"), {
        mask: await masks(page),
      })
    })

    test(`admin services list ${colorScheme}`, async ({ page }) => {
      await signIn(page)
      await page.goto("/admin/services")
      await expect(
        page.getByRole("heading", { level: 1, name: "Services" })
      ).toBeVisible()
      await expect(
        page.getByRole("link", { name: "Alarm Responses" }).first()
      ).toBeVisible()
      await expect(page).toHaveScreenshot(shot("services"), {
        mask: await masks(page),
      })
    })

    test(`admin service editor ${colorScheme}`, async ({ page }) => {
      await signIn(page)
      await page.goto("/admin/services")
      await page.getByRole("link", { name: "Alarm Responses" }).first().click()
      await editorReady(page, "Alarm Responses")
      await expect(page).toHaveScreenshot(shot("service-editor"), {
        mask: await masks(page),
      })
    })

    test(`admin articles list ${colorScheme}`, async ({ page }) => {
      await signIn(page)
      await page.goto("/admin/articles")
      await expect(
        page.getByRole("heading", { level: 1, name: "Articles" })
      ).toBeVisible()
      await expect(
        page
          .getByRole("main")
          .getByRole("link", { name: /^Key Holding Explained/ })
          .first()
      ).toBeVisible()
      await expect(page).toHaveScreenshot(shot("articles"), {
        mask: await masks(page),
      })
    })

    test(`admin review queue ${colorScheme}`, async ({ page }) => {
      await page.route("**/api/v1/admin/articles?*status=in_review*", (route) =>
        route.fulfill({ json: REVIEW_QUEUE })
      )
      await signIn(page)
      await page.goto("/admin/articles?status=in_review")
      await expect(
        page.getByRole("button", { name: "Review queue" })
      ).toHaveAttribute("aria-pressed", "true")
      await expect(
        page
          .getByRole("main")
          .getByRole("link", { name: "Night Patrols Explained" })
          .first()
      ).toBeVisible()
      await expect(page).toHaveScreenshot(shot("review-queue"), {
        mask: await masks(page),
      })
    })

    test(`admin new article ${colorScheme}`, async ({ page }) => {
      await signIn(page)
      await page.goto("/admin/articles/new")
      await expect(
        page.getByRole("heading", { level: 1, name: "New article" })
      ).toBeVisible()
      await expect(page.getByLabel("Category", { exact: true })).toContainText(
        "Mobile Patrols"
      )
      await page.evaluate(() => document.fonts.ready)
      await expect(page).toHaveScreenshot(shot("new-article"), {
        mask: await masks(page),
      })
    })

    test(`admin article editor as author ${colorScheme}`, async ({ page }) => {
      await signIn(page, VISUAL_AUTHOR)
      await openArticle(page, PATROLS, {
        live: false,
        status: "draft",
        published: null,
        dirty: true,
        publishedAt: null,
        scheduledAt: null,
        readTimeMinutes: null,
        permissions: AUTHOR_RIGHTS,
        author: { id: "author", name: VISUAL_AUTHOR.name, title: null },
        updatedBy: { id: "author", name: VISUAL_AUTHOR.name },
      })
      await articleReady(page, PATROLS_TITLE)
      await expect(
        page.getByRole("button", { name: "Submit for review" })
      ).toBeVisible()
      await expect(page).toHaveScreenshot(shot("article-author"), {
        mask: await masks(page),
      })
    })

    test(`admin article in review ${colorScheme}`, async ({ page }) => {
      await signIn(page, VISUAL_EDITOR)
      await openArticle(page, PATROLS, {
        live: false,
        status: "in_review",
        published: null,
        dirty: true,
        publishedAt: null,
        scheduledAt: null,
        readTimeMinutes: null,
        permissions: EDITOR_RIGHTS,
        updatedBy: { id: "author", name: VISUAL_AUTHOR.name },
      })
      await articleReady(page, PATROLS_TITLE)
      await expect(
        page.getByRole("button", { name: "Publish", exact: true })
      ).toBeVisible()
      await expect(page).toHaveScreenshot(shot("article-review"), {
        mask: await masks(page),
      })
    })

    for (const dialog of [false, true])
      test(`admin article scheduled${dialog ? " + schedule dialog" : ""} ${colorScheme}`, async ({
        page,
      }) => {
        await signIn(page, VISUAL_EDITOR)
        await openArticle(page, PATROLS, {
          live: false,
          status: "scheduled",
          published: null,
          dirty: true,
          publishedAt: null,
          scheduledAt: "2099-11-02T09:30:00.000Z",
          readTimeMinutes: null,
          permissions: EDITOR_RIGHTS,
        })
        await articleReady(page, PATROLS_TITLE)
        await expect(
          page.getByRole("button", { name: "Cancel schedule" })
        ).toBeVisible()
        if (!dialog) {
          await expect(page).toHaveScreenshot(shot("article-scheduled"), {
            mask: await masks(page),
          })
          return
        }
        await page.getByRole("button", { name: "Reschedule" }).click()
        const schedule = page.getByRole("dialog", {
          name: "Schedule publishing",
        })
        await expect(schedule.getByLabel("Publish on")).toHaveValue(
          "2099-11-02T09:30"
        )
        await expect(page).toHaveScreenshot(shot("article-schedule-dialog"), {
          mask: await overlayOnly(page),
        })
      })

    test(`admin featured article settings ${colorScheme}`, async ({ page }) => {
      // The live, featured article: settings and details filled in, and the
      // panel says why it cannot be unpublished, deleted or moved.
      await signIn(page, VISUAL_EDITOR)
      await openArticle(page, "18-years-of-watching-over-ireland", {
        publishedAt: "2026-10-01T08:00:00.000Z",
        permissions: EDITOR_RIGHTS,
      })
      await articleReady(page, "18 Years of Watching Over Ireland")
      await expect(
        page.getByText(/The blog page features this article\./)
      ).toBeVisible()
      await expect(page).toHaveScreenshot(shot("article-featured"), {
        mask: await masks(page),
      })
    })

    test(`admin team collection ${colorScheme}`, async ({ page }) => {
      await signIn(page)
      await page.goto("/admin/team")
      await expect(
        page.getByRole("navigation", { name: "Collections" })
      ).toBeVisible()
      await expect(
        page.getByRole("button", { name: "Edit Michael McDonald" }).first()
      ).toBeVisible()
      await expect(page).toHaveScreenshot(shot("team"), {
        mask: await masks(page),
      })
      // The record sheet (edit one team member).
      await page
        .getByRole("button", { name: "Edit Michael McDonald" })
        .first()
        .click()
      const sheet = page.getByRole("dialog", { name: "Team member" })
      await expect(sheet).toBeVisible()
      await expect(sheet.getByLabel("Name", { exact: true })).toHaveValue(
        "Michael McDonald"
      )
      await expect(page).toHaveScreenshot(shot("team-record-sheet"), {
        mask: await overlayOnly(page),
      })
    })

    test(`admin site settings ${colorScheme}`, async ({ page }) => {
      await signIn(page)
      await page.goto("/admin/settings/site")
      await expect(
        page.getByRole("navigation", { name: "Settings" })
      ).toBeVisible()
      await editorReady(page, "Site")
      await expect(page).toHaveScreenshot(shot("settings-site"), {
        mask: await masks(page),
      })
    })

    test(`admin integrations ${colorScheme}`, async ({ page }) => {
      await pinIntegrations(page)
      await signIn(page)
      await page.goto("/admin/settings/integrations")
      await expect(
        page.getByRole("heading", { level: 1, name: "Integrations" })
      ).toBeVisible()
      await expect(
        page.getByRole("link", { name: /AI assistant/ })
      ).toBeVisible()
      await expect(page).toHaveScreenshot(shot("integrations"), {
        mask: await masks(page),
      })
    })

    test(`admin SMTP integration saved ${colorScheme}`, async ({ page }) => {
      await pinIntegrations(page)
      await signIn(page)
      await page.goto("/admin/settings/integrations/smtp")
      await expect(page.getByText("Saved · ends in 1234")).toBeVisible()
      await page.getByRole("button", { name: "Test connection" }).click()
      await expect(
        page.getByRole("status", { name: "Connection test" })
      ).toContainText("Test passed")
      // The click scrolled the panel to the buttons: back to the top, so the
      // shot pins the header, the status and the password's saved line.
      await page.locator("main#main").evaluate((main) => main.scrollTo(0, 0))
      await page.evaluate(() => window.scrollTo(0, 0))
      await expect(page).toHaveScreenshot(shot("integration-smtp"), {
        mask: await masks(page),
      })
    })

    test(`admin SMTP integration test failed ${colorScheme}`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "desktop",
        "one failed-result baseline (desktop) is enough"
      )
      await pinIntegrations(page)
      // Added last, so it answers before the passing pin.
      await page.route(
        "**/api/v1/admin/integrations/integrations.smtp/test",
        (route) =>
          route.fulfill({
            json: {
              ok: false,
              message:
                "The server did not respond in time (smtp.example.ie:587).",
              testedAt: "2026-10-16T09:00:00.000Z",
            },
          })
      )
      await signIn(page)
      await page.goto("/admin/settings/integrations/smtp")
      await expect(page.getByText("Saved · ends in 1234")).toBeVisible()
      await page.getByRole("button", { name: "Test connection" }).click()
      const result = page.getByRole("status", { name: "Connection test" })
      await expect(result).toContainText("Test failed")
      await result.scrollIntoViewIfNeeded()
      await expect(page).toHaveScreenshot(shot("integration-smtp-failed"), {
        mask: await masks(page),
      })
    })

    test(`admin R2 integration not set up ${colorScheme}`, async ({ page }) => {
      await pinIntegrations(page)
      await signIn(page)
      await page.goto("/admin/settings/integrations/r2")
      await expect(page.getByLabel("Location")).toHaveValue("default")
      await page.evaluate(() => document.fonts.ready)
      await expect(page).toHaveScreenshot(shot("integration-r2"), {
        mask: await masks(page),
      })
    })

    test(`admin contact settings with the live preview ${colorScheme}`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "desktop",
        "the live preview pane exists from 1536 px up"
      )
      await page.setViewportSize({ width: 1600, height: 900 })
      await signIn(page)
      await page.goto("/admin/settings/contact")
      await editorReady(page, "Contact details")
      await page.getByRole("switch", { name: "Live preview" }).click()
      const pane = page.getByRole("region", { name: "Live preview" })
      await expect(pane).toBeVisible()
      await expect(pane.locator('iframe[title="Page preview"]')).toBeVisible()
      await expect(pane.getByLabel("Refreshing")).toHaveCount(0)
      // The frame shows the public site (pinned by its own baselines).
      await expect(page).toHaveScreenshot(shot("settings-contact-preview"), {
        mask: [
          ...(await masks(page)),
          pane.locator('iframe[title="Page preview"]'),
        ],
      })
    })

    for (const tab of [
      { id: "profile", label: "Profile" },
      { id: "security", label: "Security" },
      { id: "sessions", label: "Devices" },
    ]) {
      test(`admin account ${tab.id} ${colorScheme}`, async ({ page }) => {
        await signIn(page)
        await page.goto(`/admin/account?tab=${tab.id}`)
        const tabs = page.getByRole("tablist", { name: "Account sections" })
        await expect(
          tabs.getByRole("tab", { name: tab.label })
        ).toHaveAttribute("aria-selected", "true")
        if (tab.id === "sessions") {
          // Every screenshot test signs in afresh: keep only this session,
          // so the list has one row whatever ran before.
          const devices = page.getByRole("list", { name: "Signed-in devices" })
          await expect(devices).toBeVisible()
          const others = page.getByRole("button", {
            name: "Sign out all other devices",
          })
          if (await others.isVisible()) {
            await others.click()
            await expect(others).toHaveCount(0)
          }
          await expect(devices.getByRole("listitem")).toHaveCount(1)
        }
        await page.evaluate(() => document.fonts.ready)
        await expect(page).toHaveScreenshot(shot(`account-${tab.id}`), {
          mask: await masks(page),
        })
      })
    }

    test(`admin users list ${colorScheme}`, async ({ page }) => {
      await signIn(page)
      await page.goto("/admin/users")
      // A table from 640 px, cards below: find the links in either.
      const main = page.getByRole("main")
      await expect(
        main.getByRole("link", { name: VISUAL_ADMIN.name, exact: true })
      ).toBeVisible()
      await expect(
        main.getByRole("link", { name: VISUAL_EDITOR.name, exact: true })
      ).toBeVisible()
      await expect(page).toHaveScreenshot(shot("users"), {
        mask: await masks(page),
      })
    })

    test(`admin user detail ${colorScheme}`, async ({ page }) => {
      await signIn(page)
      await page.goto("/admin/users")
      await page
        .getByRole("main")
        .getByRole("link", { name: VISUAL_EDITOR.name, exact: true })
        .click()
      await expect(
        page.getByRole("heading", { level: 1, name: VISUAL_EDITOR.name })
      ).toBeVisible()
      await expect(
        page.getByRole("tablist", { name: "User sections" })
      ).toBeVisible()
      // The click on the list row leaves the pointer over the tab rail:
      // park it, so no hover state depends on the list's row count.
      await page.mouse.move(0, 0)
      await page.evaluate(() => document.fonts.ready)
      await expect(page).toHaveScreenshot(shot("user-detail"), {
        mask: await masks(page),
      })
    })

    test(`admin audit log ${colorScheme}`, async ({ page }) => {
      await pinData(page)
      await signIn(page)
      await page.goto("/admin/audit")
      await expect(
        page.getByRole("heading", { level: 1, name: "Audit log" })
      ).toBeVisible()
      // Three pinned entries, as table rows or as cards.
      await expect(
        page.getByRole("button", { name: /^Details of/ })
      ).toHaveCount(3)
      await expect(page).toHaveScreenshot(shot("audit"), {
        mask: await masks(page),
      })
      // The detail sheet with a before/after diff.
      await page
        .getByRole("button", { name: /^Details of settings\.draft_saved/ })
        .click()
      const sheet = page.getByRole("dialog", { name: "Audit entry" })
      await expect(sheet.getByLabel("After", { exact: true })).toContainText(
        "01 234 9999"
      )
      await expect(page).toHaveScreenshot(shot("audit-detail-sheet"), {
        mask: await overlayOnly(page),
      })
    })

    test(`admin impersonation banner ${colorScheme}`, async ({ page }) => {
      await pinData(page)
      await signIn(page)
      await page.goto("/admin/users")
      await page
        .getByRole("main")
        .getByRole("link", { name: VISUAL_EDITOR.name, exact: true })
        .click()
      await page.getByRole("button", { name: "View as" }).click()
      await page
        .getByRole("alertdialog", {
          name: `View the admin as ${VISUAL_EDITOR.name}?`,
        })
        .getByRole("button", { name: "Start viewing" })
        .click()
      const banner = page.getByRole("region", { name: "Impersonation" })
      await expect(banner).toContainText(
        `You are viewing the admin as ${VISUAL_EDITOR.name}`
      )
      await expect(page.getByTestId("greeting")).toBeVisible()
      await expect(
        page.getByRole("heading", { name: "Key figures" })
      ).toBeAttached()
      await page.evaluate(() => document.fonts.ready)
      await expect(page).toHaveScreenshot(shot("impersonation"), {
        mask: await masks(page),
      })
    })

    test(`admin command palette ${colorScheme}`, async ({ page }) => {
      await pinData(page)
      await signIn(page)
      await page.getByRole("button", { name: "Search" }).click()
      const dialog = page.getByRole("dialog", { name: "Search the admin" })
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole("option").first()).toBeVisible()
      await expect(page).toHaveScreenshot(shot("command-palette"), {
        mask: await overlayOnly(page),
      })
    })

    test(`admin navigation sheet ${colorScheme}`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "mobile",
        "the sheet exists below lg only"
      )
      await pinData(page)
      await signIn(page)
      await page.getByRole("button", { name: "Toggle navigation" }).click()
      await expect(
        page.getByRole("dialog", { name: "Navigation" })
      ).toBeVisible()
      await expect(page).toHaveScreenshot(shot("nav-sheet"), {
        mask: await overlayOnly(page),
      })
    })

    test(`admin forbidden ${colorScheme}`, async ({ page }) => {
      // An editor holds no user:read: /admin/users is the 403 state.
      await signIn(page, VISUAL_EDITOR)
      await page.goto("/admin/users")
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "You do not have access to this page",
        })
      ).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      await expect(page).toHaveScreenshot(shot("forbidden"))
    })

    test(`admin not found ${colorScheme}`, async ({ page }) => {
      await signIn(page)
      await page.goto("/admin/this-page-does-not-exist")
      await expect(
        page.getByRole("heading", { level: 1, name: "That page doesn't exist" })
      ).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      await expect(page).toHaveScreenshot(shot("not-found"))
    })

    test(`admin sign-in ${colorScheme}`, async ({ page }) => {
      await page.goto("/admin/sign-in")
      await expect(
        page.getByRole("heading", { level: 1, name: "Sign in" })
      ).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      await expect(page).toHaveScreenshot(shot("sign-in"))
    })
  })
}
