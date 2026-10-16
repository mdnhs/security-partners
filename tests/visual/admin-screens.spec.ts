import { expect, type Page, test } from "@playwright/test"

import { clientIpFor } from "../e2e/fixtures"

import { VISUAL_ADMIN, VISUAL_EDITOR } from "./admin-user"

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
      href: "/admin/settings",
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
