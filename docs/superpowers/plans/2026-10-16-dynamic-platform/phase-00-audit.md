# Phase 0 — Audit, inventory, baselines

> Part of `docs/superpowers/plans/2026-10-16-dynamic-platform.md` (master). Spec: `docs/superpowers/specs/2026-10-16-dynamic-platform-design.md`. Branch `feat/dynamic-platform`. Never push.

Global constraints that bind this phase: public design frozen; visual diff must be 0 px at 1440×900 and 390×844 with animations disabled; commit messages conventional + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Field inventory and brief (master Task 0.1)

**Files:**
- Create: `docs/brief.md`
- Create: `docs/brief-inventory.json`
- Create: `scripts/check-inventory.ts` (validator; run with `pnpm dlx tsx`, no new deps needed in this phase)

**Interfaces:**
- Produces `docs/brief-inventory.json`, consumed by Phase 3 Task 3.2 tests. Exact shape:

```json
{
  "version": 1,
  "entries": [
    {
      "id": "home.hero.heading",
      "source": "components/home/hero.tsx:24",
      "kind": "text",
      "value": "Watching Over You",
      "target": "pages.home.hero.heading",
      "pages": ["/"]
    }
  ]
}
```

  - `kind` ∈ `"text" | "richText" | "image" | "alt" | "href" | "tel" | "mailto" | "list" | "aria" | "meta"`.
  - `target` is a dotted path rooted at one of: `pages.<key>.…` (keys: home, about, services, team, blog, contact, privacy, terms), `services[<slug>].…`, `articles[<slug>].…`, `team[].…`, `clients[].…`, `groupCompanies[].…`, `categories[].…`, `settings.<SettingsKey>.…` (SettingsKey list in the master plan Shared contracts).
  - Lists coming from `components/*/data.ts` arrays are recorded once per array with `kind: "list"` and `value` = number of items (e.g. `"8"` for clients), plus one entry per distinct field of the item shape with `target` like `clients[].name`. Do not create one entry per array item.
  - Inline literals in JSX (headings, paragraphs, button labels, alt text, aria-label, href, image src) get one entry each.
  - `<title>`/description in `export const metadata` get `kind: "meta"` with target `pages.<key>.seo.title|description` (or `settings.seo.defaults.*` for the root layout).

**Steps:**

- [ ] **Step 1: Write the inventory validator (the "failing test" for this doc task)**

`scripts/check-inventory.ts`:

```ts
import { readFileSync } from "node:fs"

type Entry = {
  id: string
  source: string
  kind: string
  value: string
  target: string
  pages: string[]
}

const KINDS = new Set(["text", "richText", "image", "alt", "href", "tel", "mailto", "list", "aria", "meta"])
const ROOTS = [/^pages\.(home|about|services|team|blog|contact|privacy|terms)\./, /^services\[[a-z0-9-]*\]\./, /^articles\[[a-z0-9-]*\]\./, /^(team|clients|groupCompanies|categories)\[\]\./, /^settings\.(site|contact|navigation|footer|sections\.enquireBanner|sections\.clients|sections\.whyChooseUs|seo\.defaults|consent|tracking|customCode|microcopy|leads)\./]

const raw = JSON.parse(readFileSync("docs/brief-inventory.json", "utf8")) as { version: number; entries: Entry[] }
const errors: string[] = []
if (raw.version !== 1) errors.push("version must be 1")
const ids = new Set<string>()
for (const e of raw.entries) {
  if (ids.has(e.id)) errors.push(`duplicate id ${e.id}`)
  ids.add(e.id)
  if (!KINDS.has(e.kind)) errors.push(`${e.id}: bad kind ${e.kind}`)
  if (!ROOTS.some((r) => r.test(e.target))) errors.push(`${e.id}: bad target ${e.target}`)
  if (!/^(app|components)\/.+:\d+$/.test(e.source)) errors.push(`${e.id}: bad source ${e.source}`)
  const [file, line] = e.source.split(":")
  const lines = readFileSync(file, "utf8").split("\n")
  if (Number(line) < 1 || Number(line) > lines.length) errors.push(`${e.id}: line out of range`)
  if (!Array.isArray(e.pages) || e.pages.length === 0) errors.push(`${e.id}: pages empty`)
}
if (raw.entries.length < 150) errors.push(`only ${raw.entries.length} entries — inventory incomplete`)
if (errors.length) {
  console.error(errors.join("\n"))
  process.exit(1)
}
console.log(`inventory ok: ${raw.entries.length} entries`)
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm dlx tsx scripts/check-inventory.ts`
Expected: FAIL — `ENOENT … docs/brief-inventory.json`.

- [ ] **Step 3: Build the inventory**

Read every file in `app/**/*.tsx` and `components/**/*.{ts,tsx}` (skip `components/ui/**`, `components/motion/**`, `components/theme-provider.tsx`). For each user-visible literal, add an entry per the rules above. Cover at minimum: header nav + CTA, footer (all columns, group companies, legal links, copyright), home (hero, about, services, enquire banner, clients, team, blog, contact, map), about (hero, about body, stats, values, clients, enquire), services index (hero, section heading, why choose us), service detail (hero labels, body labels such as "What's included", other services heading), team (hero, leadership heading, officers section), blog index (hero, filters, featured), article (labels like "Keep reading", "Related Articles", share labels), contact (hero, form labels/placeholders/button/messages, departments, map), every `metadata` export. Then sanity-check: `grep -rnE '"[A-Z][^"]{3,}"|>[^<{]*[A-Za-z]{4,}[^<{]*<' app components --include=*.tsx | grep -v components/ui` and make sure every hit is covered or is a non-visible string (className, data-attr).

- [ ] **Step 4: Run validator to verify it passes**

Run: `pnpm dlx tsx scripts/check-inventory.ts`
Expected: `inventory ok: <N> entries` with N ≥ 150.

- [ ] **Step 5: Write `docs/brief.md`**

Sections, in order (content taken from the spec; do not invent new decisions):
1. Requirements (spec §1.1)
2. Decisions taken on the owner's behalf — D1–D10 from spec §1.3, each suffixed "(confirm or correct)"
3. Deviations from the starter prompt (spec §1.4)
4. Open questions with defaults: final privacy/terms copy (default: placeholder legal text marked for owner review), lead notification recipients (default: `info@securitypartnersltd.com`), OG image style (default: generated from brand), AI provider (default: none until configured)
5. Success criteria (spec §1.2)
6. Target architecture (spec §3 tree)
7. Content model summary (spec §5, tables)
8. Role matrix (spec §6.1)
9. API route map (spec §7)
10. Admin IA (spec §8.1)
11. Phases (master plan phase list)
12. Risks (spec §17)
13. Out of scope (spec §1.5)
14. Field inventory summary: counts per page and per `kind`, plus "full list: `docs/brief-inventory.json`"
15. `## Changes` — empty list header; later phases append `- 2026-MM-DD: …`

- [ ] **Step 6: Commit**

```bash
git add docs/brief.md docs/brief-inventory.json scripts/check-inventory.ts
git commit -m "docs: add project brief and public-site field inventory

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Visual baseline harness (master Task 0.2)

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/visual/urls.ts`
- Create: `tests/visual/freeze-motion.ts`
- Create: `tests/visual/public-pages.spec.ts`
- Modify: `package.json` (devDependency `@playwright/test@1.64.1`; scripts)
- Modify: `.gitignore` (add `test-results/`, `playwright-report/`, `.data/`)
- Create (generated): `tests/visual/__screenshots__/**`

**Interfaces:**
- Produces `PUBLIC_URLS: readonly string[]` from `tests/visual/urls.ts` and `freezeMotion(page: Page): Promise<void>` from `tests/visual/freeze-motion.ts`. Later phases import both and must not change the screenshot names.
- Screenshot name format: `<slugified-url>-<project>.png` where `/` → `home`, `/services/alarm-responses` → `services-alarm-responses`.

**Steps:**

- [ ] **Step 1: Install Playwright and browsers**

```bash
pnpm add -D @playwright/test@1.64.1
pnpm exec playwright install chromium
```

- [ ] **Step 2: URL list**

`tests/visual/urls.ts` — build the list from the current data so every service and article page is covered. Because `components/*/data.ts` will be deleted in Phase 3, the list is a literal (generate it once now and paste the literal array):

```ts
// Every public URL that must stay pixel-identical. Literal on purpose:
// the data modules this was generated from are deleted in Phase 3.
export const PUBLIC_URLS = [
  "/",
  "/about",
  "/services",
  "/team",
  "/blog",
  "/contact",
  // one entry per service slug in components/home/data.ts `services`
  // one entry per article slug in components/home/data.ts `allPosts`
] as const
```

Fill the two commented groups with the actual `/services/<slug>` and `/blog/<slug>` values (run `pnpm dlx tsx -e "import('./components/home/data.ts').then(m=>console.log(JSON.stringify([...m.services.map(s=>'/services/'+s.slug), ...m.allPosts.map(p=>'/blog/'+p.slug)])))"`), and delete the two comment lines.

- [ ] **Step 3: freezeMotion helper**

`tests/visual/freeze-motion.ts`:

```ts
import type { Page } from "@playwright/test"

// The site's GSAP + Lenis code honours prefers-reduced-motion, which leaves every
// element in its final state. We also wait for fonts and lazy images so screenshots
// are deterministic.
export async function freezeMotion(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addStyleTag({
    content: `*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}`,
  })
  await page.evaluate(async () => {
    await document.fonts.ready
    const imgs = Array.from(document.images)
    for (const img of imgs) img.loading = "eager"
    await Promise.all(
      imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = () => r(null) }))),
    )
  })
}
```

Note: `emulateMedia` must run before navigation as well; the spec file sets `reducedMotion` in `use` config too.

- [ ] **Step 4: Playwright config**

`playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test"

const PORT = Number(process.env.PW_PORT ?? 3100)

export default defineConfig({
  testDir: "tests",
  testMatch: ["visual/**/*.spec.ts", "e2e/**/*.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  snapshotPathTemplate: "{testDir}/visual/__screenshots__/{arg}-{projectName}{ext}",
  expect: {
    toHaveScreenshot: { maxDiffPixels: 0, animations: "disabled", caret: "hide", scale: "css" },
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: false, hasTouch: true } },
  ],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
})
```

- [ ] **Step 5: The visual spec**

`tests/visual/public-pages.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

import { freezeMotion } from "./freeze-motion"
import { PUBLIC_URLS } from "./urls"

const name = (url: string) => (url === "/" ? "home" : url.slice(1).replaceAll("/", "-"))

for (const url of PUBLIC_URLS) {
  test(`public page ${url} is pixel-identical`, async ({ page }) => {
    await page.goto(url, { waitUntil: "networkidle" })
    await freezeMotion(page)
    await expect(page).toHaveScreenshot(`${name(url)}.png`, { fullPage: true })
  })
}
```

- [ ] **Step 6: Scripts + gitignore**

In `package.json` scripts add:

```json
"test:visual": "playwright test tests/visual",
"test:visual:update": "playwright test tests/visual --update-snapshots"
```

Append to `.gitignore`: `test-results/`, `playwright-report/`, `.data/`.

- [ ] **Step 7: Generate baselines**

Run: `pnpm test:visual:update`
Expected: all tests pass, PNGs written to `tests/visual/__screenshots__/` (2 per URL).

- [ ] **Step 8: Prove determinism (the "test passes" step)**

Run: `pnpm test:visual` twice.
Expected: both runs PASS with 0 diff. If a page flakes (e.g. map iframe, date-based content, lazy images), fix the cause inside `freezeMotion` (e.g. wait for the iframe `load`, or mask the third-party iframe via `mask: [page.locator('iframe')]` in the spec — masking only third-party embeds is allowed, never site content) and regenerate. Record any mask in the report.

- [ ] **Step 9: Commit**

```bash
git add playwright.config.ts tests/visual package.json pnpm-lock.yaml .gitignore
git commit -m "test: add visual baselines of the static public site

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
