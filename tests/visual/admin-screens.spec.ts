import { expect, type Page, test } from "@playwright/test"

import {
  askAssistant,
  assistantOnHomeEditor,
  openAssistant,
} from "../e2e/ai-pins"
import { clientIpFor } from "../e2e/fixtures"
import {
  freezeUploads,
  MEDIA_ITEMS,
  pinMedia,
  PNG_1PX,
  visibleImagesLoaded,
} from "../e2e/media-pins"

import {
  VISUAL_ADMIN,
  VISUAL_AUTHOR,
  VISUAL_EDITOR,
  VISUAL_OWNER,
} from "./admin-user"

// Baselines are macOS renders (ledger ruling): CI runs E2E only.
test.skip(process.platform !== "darwin", "visual baselines are macOS-only")

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

/**
 * SEO › Overview, pinned (Phase 8): three published records, one with an
 * issue (4 checks each: 11 of 12 pass), and a draft article. Also feeds
 * the dashboard's Content health gauge.
 */
const SEO_ENTRY = {
  seo: {},
  image: "generated",
  issues: [] as { check: string; message: string }[],
}
const SEO_OVERVIEW = {
  entries: [
    {
      ...SEO_ENTRY,
      kind: "page",
      id: "home",
      name: "Home",
      path: "/",
      published: true,
      title: "Security Partners Ltd. | Watching Over You",
      description: "Security services across Ireland.",
      fallback: {
        title: "Security Partners Ltd. | Watching Over You",
        description: "Security services across Ireland.",
      },
      issues: [
        {
          check: "own-description",
          message: "Uses the site-wide default description.",
        },
      ],
    },
    {
      ...SEO_ENTRY,
      kind: "page",
      id: "about",
      name: "About",
      path: "/about",
      published: true,
      title: "About | Security Partners Ltd.",
      description:
        "Eighteen years of watching over Irish homes and businesses, day and night.",
      fallback: {
        title: "About | Security Partners Ltd.",
        description:
          "Eighteen years of watching over Irish homes and businesses, day and night.",
      },
    },
    {
      ...SEO_ENTRY,
      kind: "service",
      id: "0190f0e0-0000-7000-8000-0000000000b1",
      name: "Alarm Responses",
      path: "/services/alarm-responses",
      published: true,
      title: "Alarm Responses | Security Partners Ltd.",
      description:
        "Keyholders on call around the clock: we attend every alarm activation.",
      fallback: {
        title: "Alarm Responses | Security Partners Ltd.",
        description:
          "Keyholders on call around the clock: we attend every alarm activation.",
      },
    },
    {
      ...SEO_ENTRY,
      kind: "article",
      id: "0190f0e0-0000-7000-8000-0000000000b2",
      name: "Night Patrols Explained",
      path: "/blog/night-patrols-explained",
      published: false,
      title: "Night Patrols Explained | Security Partners Ltd.",
      description: "Security services across Ireland.",
      fallback: {
        title: "Night Patrols Explained | Security Partners Ltd.",
        description: "Security services across Ireland.",
      },
    },
  ],
  checks: { passed: 11, total: 12 },
}

/** SEO › Redirects, pinned (Phase 8 Task 9): hits change with every run. */
const REDIRECT_TIMES = {
  createdAt: "2026-10-01T09:00:00.000Z",
  updatedAt: "2026-10-16T09:00:00.000Z",
}
const REDIRECTS = {
  items: [
    {
      id: "0190f0e0-0000-7000-8000-0000000000c1",
      fromPath: "/old-alarms",
      toPath: "/services/alarm-responses",
      code: 301,
      hits: 1234,
      ...REDIRECT_TIMES,
    },
    {
      id: "0190f0e0-0000-7000-8000-0000000000c2",
      fromPath: "/winter-offer",
      toPath: "/contact",
      code: 302,
      hits: 18,
      ...REDIRECT_TIMES,
    },
  ],
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
  await page.route("**/api/v1/admin/seo/overview", (route) =>
    route.fulfill({ json: SEO_OVERVIEW })
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
  // The sidebar's lead count is server-rendered from the database (not
  // pinnable with page.route): the visual seed has no enquiries, so it stays
  // hidden. A lead left by another spec (the public contact form e2e posts
  // a real one) would show it in every shot — fail loudly instead.
  await expect(page.getByLabel(/ new leads$/)).toHaveCount(0)
  // Same for the bell's red dot (unassigned leads, failed jobs, unreadable
  // Turnstile): the visual seed has none of them, so no shot shows it.
  await expect(page.locator('[data-slot="notification-dot"]')).toHaveCount(0)
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
/** main#main's scrollTop if it is the same across two frames, else null. */
function settledMainScrollTop(page: Page): Promise<number | null> {
  return page.evaluate(
    () =>
      new Promise<number | null>((resolve) => {
        const main = document.querySelector("main#main")
        const before = main?.scrollTop ?? 0
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const after = main?.scrollTop ?? 0
            resolve(after === before ? after : null)
          })
        )
      })
  )
}

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
  await page.goto(`/admin/insights/${article.id}`)
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
  await page.route(
    "**/api/v1/admin/integrations/integrations.r2/migrate-media",
    (route) =>
      route.fulfill({
        json: {
          r2Configured: false,
          r2Error: null,
          failed: [],
          onDisk: 12,
          inR2: 0,
          state: "idle",
          lastRunAt: null,
          lastError: null,
        },
      })
  )
}

/**
 * The leads inbox and one lead, pinned (Phase 7): the visual seed has no
 * enquiries, so the list, the detail and the assignee list are served.
 */
const LEAD_ID = "0190f0e0-0000-7000-8000-0000000000d1"
const LEAD_ROWS = [
  {
    id: LEAD_ID,
    name: "Siobhán Byrne",
    email: "siobhan@harbourlogistics.ie",
    phone: "087 123 4567",
    company: "Harbour Logistics",
    status: "new",
    assignee: null,
    sourcePage: "/contact",
    createdAt: "2026-10-16T09:00:00.000Z",
  },
  {
    id: "0190f0e0-0000-7000-8000-0000000000d2",
    name: "Declan Murphy",
    email: "declan@murphybuild.ie",
    phone: null,
    company: "Murphy Build",
    status: "contacted",
    assignee: { id: "u1", name: "Vera Visual" },
    sourcePage: "/services/mobile-patrols",
    createdAt: "2026-10-15T14:30:00.000Z",
  },
  {
    id: "0190f0e0-0000-7000-8000-0000000000d3",
    name: "Aoife Kelly",
    email: "aoife.kelly@example.ie",
    phone: "01 555 0101",
    company: null,
    status: "won",
    assignee: { id: "u1", name: "Vera Visual" },
    sourcePage: null,
    createdAt: "2026-10-12T11:15:00.000Z",
  },
]
const LEAD_DETAIL = {
  ...LEAD_ROWS[0],
  service: "Mobile patrols",
  message:
    "Hello,\n\nWe need night patrols for our Dublin Port depot, Monday to Saturday.\nCould someone call me this week?\n\nThanks, Siobhán",
  consent: true,
  updatedAt: "2026-10-16T10:00:00.000Z",
  events: [
    {
      id: "e1",
      type: "created",
      body: "Sent from /contact",
      actor: null,
      createdAt: "2026-10-16T09:00:00.000Z",
    },
    {
      id: "e2",
      type: "email",
      body: "Notification sent to enquiries@example.ie",
      actor: null,
      createdAt: "2026-10-16T09:00:01.000Z",
    },
    {
      id: "e3",
      type: "note",
      body: "Left a voicemail; will try again tomorrow morning.",
      actor: { id: "u1", name: "Vera Visual" },
      createdAt: "2026-10-16T10:00:00.000Z",
    },
  ],
}

async function pinLeads(page: Page) {
  await page.route("**/api/v1/admin/leads?*", (route) =>
    route.fulfill({
      json: { items: LEAD_ROWS, page: 1, pageSize: 20, total: 3 },
    })
  )
  await page.route("**/api/v1/admin/leads/assignees", (route) =>
    route.fulfill({
      json: {
        items: [{ id: "u1", name: "Vera Visual", email: VISUAL_ADMIN.email }],
      },
    })
  )
  await page.route(`**/api/v1/admin/leads/${LEAD_ID}`, (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: LEAD_DETAIL })
      : route.abort()
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
      await page.goto("/admin/insights")
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
      await page.goto("/admin/insights?status=in_review")
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
      await page.goto("/admin/insights/new")
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
      await page.goto("/admin/collections/team")
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

    test(`admin SEO overview ${colorScheme}`, async ({ page }) => {
      await pinData(page)
      await signIn(page)
      await page.goto("/admin/seo")
      await expect(page.getByRole("navigation", { name: "SEO" })).toBeVisible()
      await expect(page.getByText("91%")).toBeVisible()
      await expect(
        page.getByText("1 of 3 published pages need attention.")
      ).toBeVisible()
      await expect(page).toHaveScreenshot(shot("seo-overview"), {
        mask: await masks(page),
      })
    })

    test(`admin SEO sheet ${colorScheme}`, async ({ page }) => {
      await pinData(page)
      await signIn(page)
      await page.goto("/admin/seo")
      await page.getByRole("button", { name: "Edit SEO for Home" }).click()
      const sheet = page.getByRole("dialog", { name: "SEO: Home" })
      await expect(sheet.getByText("Search result preview")).toBeVisible()
      await expect(page).toHaveScreenshot(shot("seo-sheet"), {
        mask: await overlayOnly(page),
      })
    })

    test(`admin SEO defaults ${colorScheme}`, async ({ page }) => {
      await signIn(page)
      await page.goto("/admin/seo/defaults")
      await editorReady(page, "SEO defaults")
      await expect(
        // The schema form shows its groups as tabs (General selected).
        page.getByRole("tab", { name: "Business details for search engines" })
      ).toBeVisible()
      await expect(page).toHaveScreenshot(shot("seo-defaults"), {
        mask: await masks(page),
      })
    })

    test(`admin redirects ${colorScheme}`, async ({ page }) => {
      await page.route("**/api/v1/admin/redirects?*", (route) =>
        route.fulfill({ json: REDIRECTS })
      )
      await signIn(page)
      await page.goto("/admin/seo/redirects")
      await expect(
        page.getByRole("heading", { level: 1, name: "Redirects" })
      ).toBeVisible()
      // Two pinned rows, as table rows or as cards.
      await expect(
        page.getByRole("button", { name: /^Edit redirect from/ })
      ).toHaveCount(2)
      await expect(page).toHaveScreenshot(shot("seo-redirects"), {
        mask: await masks(page),
      })
      // The add dialog.
      await page.getByRole("button", { name: "Add redirect" }).first().click()
      await expect(
        page.getByRole("dialog", { name: "Add redirect" })
      ).toBeVisible()
      await expect(page).toHaveScreenshot(shot("redirect-dialog"), {
        mask: await overlayOnly(page),
      })
    })

    test(`admin site settings ${colorScheme}`, async ({ page }) => {
      await signIn(page)
      await page.goto("/admin/settings/site")
      await expect(
        page.getByRole("navigation", { name: "Settings" })
      ).toBeVisible()
      await editorReady(page, "Identity")
      await expect(page).toHaveScreenshot(shot("settings-site"), {
        mask: await masks(page),
      })
    })

    // Phase 8 Task 11: Marketing tabs. Custom code is owner-only; it is
    // covered by tests/e2e/admin-a11y.spec.ts and consent.spec.ts. (The
    // visual seed gained an owner in MK-parity A7 for /admin/design.)
    for (const [path, title, name] of [
      ["/admin/marketing", "Tracking", "marketing-tracking"],
      ["/admin/marketing/consent", "Consent banner", "marketing-consent"],
    ] as const) {
      test(`admin ${name} ${colorScheme}`, async ({ page }) => {
        await signIn(page)
        await page.goto(path)
        await expect(
          page.getByRole("navigation", { name: "Marketing" })
        ).toBeVisible()
        await editorReady(page, title)
        await expect(page).toHaveScreenshot(shot(name), {
          mask: await masks(page),
        })
      })
    }

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
      await expect(
        page.getByText("12 files on the server disk · 0 in R2")
      ).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      await expect(page).toHaveScreenshot(shot("integration-r2"), {
        mask: await masks(page),
      })
      // The "Move existing uploads" panel sits below the fold (Phase 6
      // Task 8): its own shot, scrolled into view.
      await page
        .getByText("Move existing uploads to R2", { exact: true })
        .scrollIntoViewIfNeeded()
      await expect(page).toHaveScreenshot(shot("integration-r2-move"), {
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

    test(`admin media library ${colorScheme}`, async ({ page }) => {
      await pinMedia(page)
      await signIn(page)
      await page.goto("/admin/media")
      await expect(
        page.getByRole("heading", { level: 1, name: "Media" })
      ).toBeVisible()
      const files = page.getByRole("list", { name: "Files" })
      await expect(files.getByRole("listitem")).toHaveCount(MEDIA_ITEMS.length)
      await expect.poll(() => visibleImagesLoaded(page)).toBe(true)
      await expect(page).toHaveScreenshot(shot("media"), {
        mask: await masks(page),
      })
      // The list view (Dimensions and Added hidden on phones).
      await page.getByRole("button", { name: "List", exact: true }).click()
      await expect(page.getByRole("table", { name: "Files" })).toBeVisible()
      await expect.poll(() => visibleImagesLoaded(page)).toBe(true)
      await expect(page).toHaveScreenshot(shot("media-list"), {
        mask: await masks(page),
      })
    })

    test(`admin media details sheet ${colorScheme}`, async ({ page }) => {
      await pinMedia(page)
      await signIn(page)
      await page.goto("/admin/media")
      await page.getByRole("button", { name: /^patrol-car-hero\.jpg/ }).click()
      const sheet = page.getByRole("dialog", { name: "patrol-car-hero.jpg" })
      await expect(
        sheet.getByRole("link", { name: "Mobile Patrols" })
      ).toBeVisible()
      await expect.poll(() => visibleImagesLoaded(page)).toBe(true)
      await expect(page).toHaveScreenshot(shot("media-details"), {
        mask: await overlayOnly(page),
      })
    })

    test(`admin media delete refused ${colorScheme}`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "desktop",
        "one 409 baseline (desktop) is enough"
      )
      await pinMedia(page)
      await signIn(page)
      await page.goto("/admin/media")
      await page.getByRole("button", { name: /^patrol-car-hero\.jpg/ }).click()
      const sheet = page.getByRole("dialog", { name: "patrol-car-hero.jpg" })
      await sheet.getByRole("button", { name: "Delete" }).click()
      await page
        .getByRole("alertdialog", { name: "Delete this file?" })
        .getByRole("button", { name: "Delete" })
        .click()
      const alert = sheet.getByRole("alert")
      await expect(alert).toContainText("This file is used in 2 places.")
      await alert.scrollIntoViewIfNeeded()
      await expect.poll(() => visibleImagesLoaded(page)).toBe(true)
      await expect(page).toHaveScreenshot(shot("media-delete-409"), {
        mask: await overlayOnly(page),
      })
    })

    test(`admin media upload in progress ${colorScheme}`, async ({ page }) => {
      await freezeUploads(page)
      await pinMedia(page)
      await signIn(page)
      await page.goto("/admin/media")
      await expect(
        page.getByRole("list", { name: "Files" }).getByRole("listitem")
      ).toHaveCount(MEDIA_ITEMS.length)
      await page.locator("[data-upload-input]").setInputFiles([
        {
          name: "night-shift-rota.png",
          mimeType: "image/png",
          buffer: PNG_1PX,
        },
        { name: "fail-scan.tiff", mimeType: "image/tiff", buffer: PNG_1PX },
      ])
      const uploads = page.getByRole("list", { name: "Uploads" })
      await expect(
        uploads.getByRole("progressbar", {
          name: "Uploading night-shift-rota.png",
        })
      ).toHaveAttribute("aria-valuenow", "40")
      await expect(uploads.getByRole("alert")).toContainText(
        "Upload a JPEG, PNG, WebP, AVIF, SVG or PDF file"
      )
      await page.locator("main#main").evaluate((main) => main.scrollTo(0, 0))
      await page.evaluate(() => window.scrollTo(0, 0))
      await expect(page).toHaveScreenshot(shot("media-upload"), {
        mask: await masks(page),
      })
    })

    test(`admin media picker upload ${colorScheme}`, async ({ page }) => {
      await freezeUploads(page)
      await pinMedia(page)
      await signIn(page)
      await page.goto("/admin/pages/home")
      await editorReady(page, "Home")
      // The editor page shows through the picker's backdrop: open it from
      // a settled scroll position (images loaded, the button scrolled into
      // view, main's scrollTop unchanged across two frames) so the backdrop
      // is the same every run.
      const change = page
        .getByRole("region", { name: "Hero" })
        .getByRole("button", { name: "Change image: Background image" })
      await expect.poll(() => visibleImagesLoaded(page)).toBe(true)
      await change.scrollIntoViewIfNeeded()
      await expect.poll(() => settledMainScrollTop(page)).not.toBeNull()
      await change.click()
      const picker = page.getByRole("dialog", {
        name: "Choose: Background image",
      })
      await expect(
        picker.getByRole("list", { name: "Images" }).getByRole("listitem")
      ).toHaveCount(
        MEDIA_ITEMS.filter((m) => m.mime !== "application/pdf").length
      )
      await picker.locator("[data-upload-input]").setInputFiles({
        name: "night-shift-rota.png",
        mimeType: "image/png",
        buffer: PNG_1PX,
      })
      await expect(
        picker.getByRole("progressbar", {
          name: "Uploading night-shift-rota.png",
        })
      ).toHaveAttribute("aria-valuenow", "40")
      await expect.poll(() => visibleImagesLoaded(page)).toBe(true)
      // The scroll offset the baselines were captured at (desktop/mobile).
      // Mobile: 853 since the 44 px coarse SectionTabs (final review I4,
      // +8 px above the Hero card; was 845).
      const baselineScrollTop = page.viewportSize()!.width >= 1024 ? 558 : 853
      await expect
        .poll(() => settledMainScrollTop(page))
        .toBe(baselineScrollTop)
      await expect(page).toHaveScreenshot(shot("media-picker-upload"), {
        mask: await overlayOnly(page),
      })
    })

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

    test(`admin leads inbox ${colorScheme}`, async ({ page }) => {
      await pinLeads(page)
      await signIn(page)
      await page.goto("/admin/leads")
      await expect(
        page.getByRole("heading", { level: 1, name: "Leads" })
      ).toBeVisible()
      // A table from 640 px, cards below: find the links in either.
      await expect(
        page
          .getByRole("main")
          .getByRole("link", { name: "Siobhán Byrne", exact: true })
      ).toBeVisible()
      await expect(page).toHaveScreenshot(shot("leads"), {
        mask: await masks(page),
      })
    })

    for (const tab of ["details", "notes", "activity"] as const)
      test(`admin lead ${tab} ${colorScheme}`, async ({ page }) => {
        await pinLeads(page)
        await signIn(page)
        await page.goto(`/admin/leads/${LEAD_ID}?tab=${tab}`)
        await expect(
          page.getByRole("heading", { level: 1, name: "Siobhán Byrne" })
        ).toBeVisible()
        await expect(
          page
            .getByRole("tablist", { name: "Lead sections" })
            .getByRole("tab", { selected: true })
        ).toContainText(tab, { ignoreCase: true })
        // Only waits for the assignee list to load (its option text), so
        // the shot never catches the select half-filled; the pinned lead
        // itself is unassigned.
        if (tab === "details")
          await expect(page.getByLabel("Assigned to")).toContainText(
            "Vera Visual"
          )
        await page.evaluate(() => document.fonts.ready)
        await expect(page).toHaveScreenshot(shot(`lead-${tab}`), {
          mask: await masks(page),
        })
      })

    test(`admin lead delete dialog ${colorScheme}`, async ({ page }) => {
      await pinLeads(page)
      await signIn(page)
      await page.goto(`/admin/leads/${LEAD_ID}`)
      await page.getByRole("button", { name: "Delete", exact: true }).click()
      await expect(
        page.getByRole("alertdialog", { name: "Delete this lead?" })
      ).toBeVisible()
      await expect(page).toHaveScreenshot(shot("lead-delete-dialog"), {
        mask: await overlayOnly(page),
      })
    })

    test(`admin activity log ${colorScheme}`, async ({ page }) => {
      await pinData(page)
      await signIn(page)
      await page.goto("/admin/activity")
      await expect(
        page.getByRole("heading", { level: 1, name: "Activity log" })
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

    // Phase 9: the AI assistant panel on the home page editor, empty (the
    // "Using" chip and starter prompts), after a reply (Copy / Insert) and
    // its past conversations. Status, chat stream and history are pinned
    // (tests/e2e/ai-pins.ts): no request reaches an AI provider, and the
    // reply is not inserted (that would autosave the seeded page).
    test(`admin AI assistant ${colorScheme}`, async ({ page }) => {
      await signIn(page)
      await assistantOnHomeEditor(page, SMTP_SAVED)
      const panel = await openAssistant(page)
      await expect(panel.getByText(/Using:/)).toBeVisible()
      await expect(
        panel.getByRole("list", { name: "Suggested questions" })
      ).toBeVisible()
      const mask = await overlayOnly(page)
      await page.evaluate(() => document.fonts.ready)
      await expect(page).toHaveScreenshot(shot("ai-assistant"), { mask })
      await askAssistant(page, panel)
      await expect(
        panel.getByRole("button", { name: /^Insert into / })
      ).toBeVisible()
      await expect(page).toHaveScreenshot(shot("ai-assistant-reply"), { mask })
      await panel.getByRole("button", { name: "Past conversations" }).click()
      await expect(
        page.getByRole("button", {
          name: "Make the hero heading shorter",
          exact: true,
        })
      ).toBeVisible()
      await expect(page).toHaveScreenshot(shot("ai-assistant-history"), {
        mask,
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

    // MK-parity A7: the owner-only component gallery, on its own sample data
    // (no API calls, nothing to pin).
    test(`admin design system ${colorScheme}`, async ({ page }) => {
      await signIn(page, VISUAL_OWNER)
      await page.goto("/admin/design")
      await expect(
        page.getByRole("heading", { level: 1, name: "Design system" })
      ).toBeVisible()
      await expect(
        page.getByRole("region", { name: "Team activity list" })
      ).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      await expect(page).toHaveScreenshot(shot("design"), {
        mask: await masks(page),
      })
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
