# Security Partners admin — Magda Kennedy (MK) parity (Design Spec)

Date: 2026-10-19 · Status: approved decisions from the owner (2026-10-19) + controller rulings · Branch `feat/dynamic-platform` (base 68a0f9a)
Reference implementation (read-only): `/Users/nazmulhasansourab/ireland/james-whitfield` (package `magda-kennedy`, "MK").
Inputs: `.superpowers/sdd/2026-10-16-dynamic-platform/mk-analysis-{1-ia,2-visual,3-features}.md`, `global-constraints.md`, `progress.md` (rulings), original spec `docs/superpowers/specs/2026-10-16-dynamic-platform-design.md` ("base spec").

---

## 0. Change note to the base spec (dated, binding)

**2026-10-19 — owner decision, supersedes base spec §1.4 rows "Block-based page builder", "Section show/hide, new pages", "Theme engine (Appearance)", "Newsletter module" and the matching items in §1.5 "Out of scope".**

| Base spec said | Now |
|---|---|
| Fixed templates only, no new pages | Fixed templates stay exactly as they are. A block **page builder** adds new pages under `/p/<slug>` only (§9). |
| Theme engine removed | **Appearance** screen + theme engine for the admin and the public site (§5). Public defaults equal today's `app/globals.css` values and emit **no** `<style>` (ruling 4). |
| Newsletter removed | **Newsletter** module (MK-equivalent). The public signup form is behind an admin placement setting that is **off by default**; the seeded site renders nothing new (ruling 2). |

Everything else in the base spec (env, RBAC, API conventions, draft/publish, frozen public design) still binds.

## 1. Goals

1. The admin looks and is organised like MK. That covers layout, structure, typography (Plus Jakarta Sans and MK weights, sizes and spacing), components, the shell, tab-rail behaviour, top-center toasts, the topbar mail icon and identity block, KPI chips, the week-vs-week chart and the shadcn primitives. The **colours stay Security Partners (SP)**: the palette is derived from the SP brand tokens and uses MK's token structure.
2. The admin IA matches MK: three nav groups, registry-driven section rails, registry-driven page guards, Site settings children, ⌘K, the dock and Help.
3. Feature parity with MK in these areas: Appearance, AI assistant, SEO, Redirects, Marketing (tracking, consent, custom code, events), Leads, Users, Dashboard, Newsletter and the Page builder. **Authors taxonomy and the Meta Conversions API are skipped.**
4. Keep what SP already does better than MK. Settings, SEO defaults, Marketing and Appearance keep draft/publish with revisions; MK's chrome (History button, MK page headers and copy) is added around it. Also kept: insert-into-field AI, external redirect targets, owner-only tag IDs, the integrations hub with Test connection, and DataTable sorting.

### 1.1 Non-goals

- Authors taxonomy.
- Meta Conversions API, including enhanced matching.
- Live-save editing.
- Changing any of the 8 fixed public pages.
- Collection show/hide switches.
- Collections beyond SP's current set: Team, Clients, Group companies and Categories, with Services keeping its own editor.
- Usage/cost dashboards.

## 2. Binding constraints (carry over + new)

- **Public design is frozen.** The 40 public visual baselines (`tests/visual/public-pages.spec.ts`: 20 URLs in `tests/visual/urls.ts` at 1440×900 and 390×844) stay at **0 px** after `pnpm db:seed`, in every phase. The consent-banner baselines (`tests/visual/consent-banner.spec.ts`) also stay at 0 px. Every new public capability is either invisible (head metadata, dataLayer, sessionStorage) or off by default.
- **Env:** exactly `DATABASE_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` (plus `NODE_ENV`, `PORT`, `HOSTNAME`). No new env vars. That includes no `DISABLE_CUSTOM_SCRIPTS`; the kill switch is a DB flag plus a CLI (§7.3).
- **Dependencies:** pinned to exact versions, and each version must have been published **≥ 14 days** before install. Check with `npm view <pkg>@<ver> time --json` and record the result in the task report. New deps, and nothing else:
  - `culori@4.0.2` and `@types/culori@4.0.1` (dev)
  - `react-colorful@5.8.1`
  - `@ai-sdk/google` and `@ai-sdk/openai-compatible`: the newest versions compatible with `ai@7.0.127` that pass the 14-day rule. MK uses `4.0.82` and `3.0.57`.
  - shadcn primitives are generated source on the existing `@base-ui/react@1.9.0`, not deps.
- **Accessibility:** WCAG 2.2 AA in the admin and on any new public UI. Coarse-pointer targets are ≥ 44 px (`pointer: coarse`). Dark mode covers every new admin screen. Status is never shown by colour alone.
- **Unchanged rules:** `next build` with no env and no DB; `import "server-only"` in `server/**`; `lib/**` never imports `server/**`; only repos import drizzle query builders; uuid v7; `timestamptz`; the error envelope; list shape; and body limits are all as in `global-constraints.md`.
- **Never `git push`.** Commits use pathspecs (`git add <paths>`, never `-A`). Messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Security rulings from `progress.md` stay:**
  - Tracking **tag IDs are owner-only** (`TRACKING_TAG_UPDATE`).
  - **Custom code is owner-only** (`customCode:*`), and so is its revision read.
  - Public readers of tracking, consent and custom code read **published** values only.
  - The proxy never matches `/api`.
  - `invalidate()` = `revalidateTag(t, { expire: 0 })`.
  - Only one agent at a time runs Playwright or `next build`.
  - The visual gate runs on this macOS machine only.

## 3. Rulings recorded (controller, 2026-10-19)

1. This dated note supersedes base spec §1.4/§1.5 for the theme engine, newsletter and block builder (§0).
2. Newsletter public signup is an admin toggle, **off by default**. In the seeded state nothing renders, and the 40 public baselines stay at 0 px.
3. Builder pages live under `/p/<slug>`. The proxy, 404, redirects and sitemap all know the prefix. There is **no top-level catch-all**.
4. Public theme: the default emits **no** `<style>` tag. A unit test asserts that the default site tokens equal the current `app/globals.css` values.
5. The AI "share enquiry details" switch is **owner-only** and off by default.
6. The derived admin palette keeps SP's contrast-tuned `destructive` (`#b91c1c` light / `#fca5a5` dark) and `warning` (`#92400e`).

---

## 4. Phase A — Visual system

### 4.1 Admin CSS is self-contained

- `app/(admin)/admin/admin.css` drops `@import "../../globals.css"` and imports `tailwindcss`, `tw-animate-css` and `shadcn/tailwind.css` directly, the way MK's `app/(admin)/admin.css` does.
- It defines its own `@theme inline` mapping (colours, radius, `--font-sans: var(--font-jakarta)`, `--font-mono`), the type scale and the rich-text styles. Rich-text links and blockquotes use `--primary`.
- Public `--color-brand-*`, `--font-heading` and the button `brand*` variants no longer reach the admin. The admin must not use the `brand`, `brand-outline*` or `pill` button variants (a unit test greps for them).
- `app/globals.css` is **not edited** in Phase A.
- Token scope stays `html[data-admin]` and `html[data-admin].dark`. Keeping it avoids churn and is equivalent to MK's `:root[data-theme="admin"]`.

### 4.2 Palette: MK structure, SP colours (preset `security-partners`)

Same token names as MK `lib/theme/tokens.ts` `ADMIN_TOKENS` (48 tokens) plus `--radius: 0.75rem`. Neutrals become MK-like near-greys (OKLCH chroma ≤ 0.012, slight cool hue) instead of today's blue-greys. Accent colours come from the SP brand: green `#67bd31` / `#4e9a22`, mint `#eef6e8` and navy `#0d1b36`.

| Token | Light | Dark |
|---|---|---|
| background | #ffffff | #0b0e13 |
| foreground / card-fg / popover-fg / secondary-fg / sidebar-fg | #0f1726 | #eceff3 |
| card / popover | #ffffff | #1a1f28 |
| primary / sidebar-primary | #367318 | #7cc84a |
| primary-fg / sidebar-primary-fg | #ffffff | #0a1408 |
| secondary | #eceff3 | #1b2029 |
| muted | #eff1f4 | #1b2029 |
| muted-fg | #5d6575 | #9aa1ad |
| accent / sidebar-accent | #eef6e8 | #1f3318 |
| accent-fg / sidebar-accent-fg | #2f5f14 | #cfeab8 |
| destructive (ruling 6) | #b91c1c | #fca5a5 |
| border / sidebar-border | #e3e6eb | #262c36 |
| input | #7b8494 | #6b7382 |
| ring / sidebar-ring | #4e9a22 | #7cc84a |
| chart-1..5 | #2f6a15 #4e9a22 #67bd31 #0d1b36 #a7d98a | #7cc84a #67bd31 #a7d98a #c7d3ea #3f6b25 |
| sidebar (panel + topbar fill) | #f2f3f5 | #13171e |
| success / success-soft | #15803d / #dcfce7 | inherit light |
| warning (ruling 6) / warning-soft | #92400e / #fef3c7 | inherit light |
| danger / danger-soft | #b91c1c / #fee2e2 | inherit light |
| skeleton | #e1e4e9 | #29303b |
| hatch | #a7d98a | #3f6b25 |
| hero-from / hero-to | #0d1b36 / #1b3566 | inherit |
| hero-fg / hero-chip / hero-chip-fg / hero-delta | #ffffff / #ffffff / #0d1b36 / #b7e892 | inherit |
| promo-from / promo-to / promo-fg | #071022 / #13284d / #ffffff | inherit |

**Gate:** `lib/theme/checks.ts` (Phase C) and, earlier, the A1 token test both check `ADMIN_PAIRS` (foreground/background, primary-fg/primary, muted-fg/muted, muted-fg/sidebar, accent-fg/accent, destructive/background and so on) at **≥ 4.5:1**, and borders/rings at **≥ 3:1**. If a listed value fails, the implementer may move **lightness only**, in steps of 0.01 L, and must record the final hex in this table via a dated change note. Hue and chroma stay.

### 4.3 Typography

- **Fonts:** Plus Jakarta Sans via `next/font/google` (`variable: "--font-jakarta"`, `display: "swap"`, weights 400/500/600/700). Geist Mono stays. Lato is removed from the admin layout.
- **Type scale:**
  - `--text-title`: 2.25rem / 1.1 / -0.025em / 600
  - `--text-card-title`: 1.125rem / 1.35 / 600
  - `--text-kpi`: 2.75rem / 1 / -0.03em / 600
- **Brand name:** `text-base font-semibold`.
- **Titles:** the `font-heading` class is removed from Card, Dialog, Sheet and Empty titles.

### 4.4 Components and shell details

- New shadcn primitives in `components/ui/`: `select`, `tabs`, `table`, `checkbox`, `radio-group`, `scroll-area`, `item`, `breadcrumb`. They come from the base-nova style, use the same a11y tweaks as the existing primitives, and give coarse-pointer hit areas ≥ 44 px.
- Native `<select>`, `<table>` and ad-hoc tabs in admin code are replaced by these primitives.
- **Brand mark:** `size-10 rounded-full bg-accent` chip containing a square SP mark SVG (`components/admin/shell/sp-mark.tsx`, built from the shield in `public/images/logo.png` and redrawn as SVG).
- **Topbar:** trigger · search pill · AI · **Enquiries mail icon link** (`/admin/leads`, needs `lead:read`, shows the new-lead dot) · bell · user menu. The user-menu trigger shows avatar + name + email + role pill at ≥ lg.
- **Toaster** moves to `position="top-center"`.
- **KpiCard:** every KPI has an outlined arrow chip linking to its source (`href` is required). The chip is `size-10`, with a coarse 44 px hit area through `::after` padding. The hero KPI uses the hero gradient and a filled white chip.
- **PillBarChart:** two series, `current` in `chart-2` and `previous` hatched with `--hatch`, plus a legend ("This week / Last week"). An overlay reading "No enquiries yet" appears when both are empty.
- **PageHeader (MK):** title (`text-title`), description, actions on the right at lg, optional `breadcrumbs`.
- **`/admin/design`:** a component gallery for owners only (`customCode:update`, which is owner-only). It is not in the sidebar but is reachable from ⌘K. It renders every `components/ui/*` and `components/admin/kit/*` export on sample data and is a visual baseline (`design-light`, `design-dark`).

---

## 5. Phase B — IA, navigation, shell, settings structure, ⌘K

### 5.1 Nav registry (`lib/admin/nav.ts`, isomorphic)

This file replaces `components/admin/shell/nav.ts`. The shell re-exports the types for compatibility during Phase B and removes them at B's end.

| Group | Item | href | Permission | Children (rail) |
|---|---|---|---|---|
| Menu | Dashboard | /admin | null | — |
| Menu | Pages | /admin/pages | page:read | — |
| Menu | Insights | /admin/insights | article:read | Articles `/admin/insights`, Categories `/admin/insights/categories` (collection:read) |
| Menu | Services | /admin/services | service:read | — |
| Menu | Collections | /admin/collections | collection:read | Team, Clients, Group companies → `/admin/collections/{team,clients,group-companies}` |
| Menu | Media | /admin/media | media:read | — |
| Menu | Enquiries | /admin/leads | lead:read (badge new-leads) | — |
| Menu | Newsletter (D4) | /admin/newsletter | newsletter:read | — |
| Growth | SEO | /admin/seo | seo:read | Overview, Defaults, Redirects (redirect:read) |
| Growth | Marketing | /admin/marketing | marketing:read | Tracking `/admin/marketing`, Consent banner `/consent`, Event catalogue `/events` (D2), Custom code `/code` (customCode:read) |
| General | Appearance (C) | /admin/appearance | appearance:read | — |
| General | Site settings | /admin/settings | settings:read | Identity (site), Contact details, Navigation, Footer, Forms & microcopy (microcopy), Shared sections (about, contact, enquire banner, clients, why choose us; one child each), Enquiries (leads), Newsletter (D4, settings key `newsletter`), AI assistant `/admin/settings/ai-assistant` (integration:read), Integrations `/admin/settings/integrations` (integration:read) |
| General (dock) | Users & roles | /admin/users | user:read | — |
| General (dock) | Activity log | /admin/activity | audit:read | — |
| dock | Help | /admin/help | null | — |
| extra | Account | /admin/account | null | ⌘K + user menu |
| extra | Design system | /admin/design | customCode:update | ⌘K only |

Each item and child carries `keywords?: string[]` for ⌘K. For example, the AI assistant child has `["ai","assistant","claude","openai","gemini","chatbot"]`.

- **`permissionFor(pathname)`** returns the permission of the longest registered href prefix (children before items, `null` for `/admin`). Unregistered admin paths return `undefined`, and the guard turns that into `notFound()`.
- **Every** `(panel)` page calls `await requirePage("<href>")` (server DAL), which is `requirePermission(permissionFor(href))`.

### 5.2 Old URLs (permanent redirects, `next.config.ts` `redirects()` from `lib/admin/legacy-redirects.ts`)

| Old | New |
|---|---|
| /admin/articles | /admin/insights |
| /admin/articles/new | /admin/insights/new |
| /admin/articles/:id | /admin/insights/:id |
| /admin/categories | /admin/insights/categories |
| /admin/team, /admin/clients, /admin/group-companies | /admin/collections/team, /clients, /group-companies |
| /admin/audit | /admin/activity |
| /admin/marketing/tracking | /admin/marketing |
| /admin/marketing/custom-code | /admin/marketing/code |
| /admin/settings/integrations/ai | /admin/settings/ai-assistant |
| /admin/leads/:id | /admin/leads?lead=:id (D3) |

Rules for these redirects:
- They use `permanent: true` (308) and keep the query string.
- `/admin/collections` itself redirects (307) to `/admin/collections/team`.
- Every internal admin link moves to the new path: search results, notifications, dashboard, SEO `fixHref`, AI screens and e2e helpers.

### 5.3 Shell behaviour

- **SectionTabs** is rendered **once** in `AdminShell` for the active nav item when it has more than one *visible* child.
  - lg and up: a 208 px left rail (`lg:w-52`) captioned with the uppercase section label.
  - Below lg: a horizontally scrolling row (`ScrollArea`).
  - Content sits directly on the `bg-sidebar` panel; the inner white card is removed.
  - The per-route layouts that used `NavChildTabs`, `CollectionTabs` and `SettingsTabs` are deleted, and so are the back links inside the Marketing rails.
- **Footer dock:** Users & roles, Activity log, Help, Log out. Account moves to the user menu and ⌘K only.
- **`/admin/help`:** a static page with keyboard shortcuts (⌘K, ⌘J, ⌘S, Esc), "Who to contact" (owner emails from users with role owner), and links to the runbook sections. It is not "Coming soon".
- **`/admin/account`:** top Tabs Profile / Security / Devices (`?tab=`), with the MK copy.
- **⌘K:**
  - Placeholder "Search pages and actions…".
  - Groups:
    - **Go to:** registry plus children plus keywords, filtered by permission.
    - **Records:** the existing SP server search (pages, services, articles, team, leads, users).
    - **Actions:** New article, New service, New page (D5), Open live site, Switch to light / dark / system theme, Sign out.
- **Page headers:** every screen uses PageHeader with MK copy.
  - Draft/publish screens say "Changes stay in a draft until you publish."
  - The editor bar's existing **History** button (`RevisionDrawer`) is kept and shown on every draft/publish screen, including Settings, SEO defaults, Marketing and Appearance.
  - The sticky editor bar keeps Save state and Publish.
  - The back link inside a section rail is removed, because the rail itself is the navigation.

---

## 6. Phase C — Appearance (theme engine) and AI parity

### 6.1 Theme engine (`lib/theme/*`, ported from MK, isomorphic and pure)

- **`color.ts`** (culori): `Oklch`, `parseColor` (hex `#rrggbb` or `oklch(L C H)` only), `formatOklch`, `toHex`, `contrast`, `onColor`, `scale`, `nudge`, `fit`.
- **`tokens.ts`:**
  - `ADMIN_TOKENS` (48 names, §4.2).
  - `SITE_TOKENS`, the 12 SP public tokens: `brand-navy, brand-blue, brand-blue-deep, brand-green, brand-green-dark, brand-mint, brand-surface, brand-line, brand-ink, brand-muted, brand-placeholder, brand-map`. They are emitted as `--color-<token>`.
  - `SITE_SURFACES = [brand-surface, brand-mint, brand-map]`.
- **`presets.ts`:**
  - `PRESET_IDS = ["security-partners","evergreen","ocean","plum","terracotta","graphite"]`.
  - `SP_ADMIN` is the §4.2 table verbatim. A test asserts it equals `admin.css`.
  - `SP_SITE` is the 12 tokens with the exact current `app/globals.css` values. A test parses `globals.css` and asserts equality (ruling 4).
  - The other presets set the admin `primary` and the site `brand-green`, the same way MK's presets do.
- **`schema.ts`:**

  ```ts
  ThemeConfig = {
    site: {
      preset: PresetId = "security-partners",
      brand: Color | null,
      tokens: Partial<Record<SiteToken, Color>>,
    },
    admin: {
      preset = "security-partners",
      primary: Color | null,
      accent: Color | null,
      tint: "preset" | "none" | "primary",
      radius: 0 | .25 | .5 | .75 | 1 | 1.25,  // default .75
      mode: "system" | "light" | "dark",
    },
  }
  ```

  Colours are stored as canonical `oklch()`.
- **`admin.ts`:** `buildAdminTokens(admin, mode)`, as MK, with the base table `SP_ADMIN`. FIXED tokens never move: destructive, success\*, warning\*, danger\*, hero-/promo-foreground, hero-chip\*.
- **`site.ts`:** `resolveSiteTokens(site)`. `brand` shifts the green family (green, green-dark, mint) in OKLCH by the delta from `#67bd31`. The navy family moves only through explicit token overrides.
- **`css.ts`:** `siteThemeCss(site)` and `adminThemeCss(admin)` emit only the tokens that differ from the defaults, so the default theme emits `""`. `liveDeclarations` also lives here. Every declaration is rebuilt from numbers, and names are regex-checked.
- **`checks.ts`:** `SITE_PAIRS`, `ADMIN_PAIRS`, `checkTheme`, `pairRatings`, `fixIssue`, `fixAll`.

### 6.2 Storage, API, application

- **Storage:** settings key `theme` (draft/publish, revisions, audit). Migration `0010_theme` inserts the default row. Permissions are a new resource `appearance: ["read","update","publish"]` (§11).
- **API** `GET|PUT /api/v1/admin/appearance` (draft with `version`, 409 on stale), plus `POST /publish`, `/discard`, `/reset {preset, scope: "site"|"admin"|"both"}` and `/restore {revisionId, version}`. Publish fails with `VALIDATION_FAILED` while `checkTheme(draft)` is non-empty; the server re-checks.
- **Admin application:** `app/(admin)/admin/layout.tsx` renders `<AdminThemeStyle/>` (`<Suspense>`, `await connection()`, published `theme.admin`), which emits `<style id="theme-tokens">` only when the CSS is non-empty. `DefaultMode` (client) applies the published default mode unless the user picked their own (localStorage marker `sp-admin-theme-auto`).
- **Public application:** `app/(site)/layout.tsx` renders `<SiteThemeStyle/>` inside `<Suspense>`. It reads published `theme.site`, or the draft when an authorised preview is active, and renders **nothing** when the CSS is `""`. `/manifest` theme colour and OG cards follow later; they are not needed for parity.
- **UI `/admin/appearance`:** as MK §7 of the visual analysis.
  - Header: PageHeader with autosave status. Actions: Preview on site, Discard draft, Reset to preset…, Publish.
  - A blocking-issues banner.
  - Tabs **Site / Admin**:
    - Site tab: PresetGallery, ColourField Brand, Advanced tokens with lock, ContrastPanel, site preview iframe.
    - Admin tab: PresetGallery, Primary, Accent, Neutral tint, Corner radius, Default mode, ContrastPanel, AdminPreview with live recolouring via `liveDeclarations`.
  - Below the tabs: BrandAssets (logo/favicon, writes `settings.site` draft) and ThemeHistory.
  - ConflictDialog for 409s.
  - Draft autosave is debounced at 1.5 s.

### 6.3 AI parity

- **Settings page** `/admin/settings/ai-assistant` replaces the integrations AI form. Field rules:

  | Field | Rule |
  |---|---|
  | Enabled | switch |
  | Provider | radio `anthropic` · `openai` · `google` · `openai-compatible` |
  | Base URL | only for `openai-compatible`. https only; no private, loopback or link-local IPs; `http://localhost` allowed only when `NODE_ENV !== "production"` (`baseUrlProblem`) |
  | API key | write-only, Keep / Replace / Remove; changing provider or base URL removes the saved key, with a warning |
  | Model | text plus a "List models" button (rate-limited 10/min) filling a `<datalist>` |
  | Who can use it | roles; owner and admin always |
  | Extra instructions | ≤ 2000 chars; appended last to the system prompt and framed as subordinate to the rules |
  | Longest answer (max output tokens) | 64–8192, default 1024 |
  | Let the assistant read enquiry details | **owner-only**, default off, needs an acknowledgement checkbox; stores `{ enabled, acknowledgedBy, acknowledgedAt }` (ruling 5) |
  | Test | uses the saved settings; disabled with "Save first" when the form is dirty; 5/min |

  Storage stays `integrations.ai` (encrypted key, versioned, audited). Migration `0011_ai_settings` backfills the new fields.
- **Discoverability:**
  - `GET /api/v1/admin/ai/status` returns `{ available: boolean, canManage: boolean, reason: "off"|"unconfigured"|"not-allowed"|null }`. `canManage` = `integration:update`.
  - The topbar button is visible when `available || canManage`.
  - When unavailable, the panel says "The AI assistant is turned off or not set up yet." and shows a **"Set up AI assistant"** button linking to `/admin/settings/ai-assistant`.
  - Dashboard Next-up shows "Turn on the AI assistant" to managers.
- **Tools** (AI SDK `tool()`, read-only, run as the actor, offered only if the actor's role allows them, failures masked as one generic message, `stopWhen: stepCountIs(5)`):

  | Tool | Offered when | Does |
  |---|---|---|
  | `searchContent({query})` | page/service/article read | pages, services, articles, drafts included |
  | `getPage({key})` | page:read | — |
  | `getService({idOrSlug})` | service:read | — |
  | `getArticle({idOrSlug})` | article:read | text capped at 8 000 chars |
  | `getSeoHealth()` | seo:read | — |
  | `getDashboardSummary()` | always | role-filtered |
  | `getEnquiryStats({range: "7d"\|"30d"\|"90d"})` | lead:read | counts by status, service and week; names, emails, phones and messages only when the owner switch is on, otherwise never |

  The prompt is built in this order: rules → site name, today (Europe/Dublin), user first name and role → tool list → screen context → owner extra instructions.
- **Chat UX:**
  - Safe Markdown renderer (own parser; never `innerHTML`): paragraphs, headings drawn as styled text, lists, quotes, tables, code, inline marks, links with an http(s)/relative allowlist.
  - **Regenerate** last answer.
  - **Edit own sent message** and resend, which replaces it and every message after it.
  - "Using: <screen title>" chip that can be dismissed per message.

---

## 7. Phase D — Features

### 7.1 D1 SEO + Redirects

- **Checks** (`lib/seo/checks.ts`), 8 IDs, all with `fixHref`:

  | ID | Rule |
  |---|---|
  | `title-length` | 30–60 chars |
  | `title-unique` | unique across all published records |
  | `description` | 70–160; falls back to excerpt; flags default use |
  | `og-image` | effective share image ≥ 1200×630 and ratio 1.91 ± 0.05; the generated card passes |
  | `alt-text` | every image media referenced by the record has alt text or `isDecorative` |
  | `h1` | the rendered page has an H1; fixed templates always pass; builder pages pass iff their first block is `hero.page` |
  | `indexable` | not noindex, and the site robots mode is `index` |
  | `internal-link` | rich text (articles, services, legal, builder `richtext`) has ≥ 1 site-relative link; fixed non-rich pages pass |

  `fixHref` per kind: page `/admin/pages/<key>?tab=seo`; service `/admin/services/<id>?tab=seo`; article `/admin/insights/<id>?tab=seo`; builder `/admin/pages/custom/<id>?tab=seo`; media `/admin/media?missingAlt=true&open=<id>`.
- **Media:**
  - Migration `0012_media_alt` adds `is_decorative boolean not null default false` and `caption text not null default ''`.
  - The details panel gets a Decorative checkbox (alt not required), a Caption field (≤ 300) and an alt counter /500 (`MEDIA_ALT_MAX`).
  - List filter `?missingAlt=true` (image mime, `alt = ''`, not decorative).
- **SEO Overview:**
  - Gauge.
  - **Alt-text card:** "X of Y images described · Z decorative · Find images without alt text".
  - **Issues list** grouped per entity, each with a **Fix** link; filter "Needs work / All", default Needs work.
- **Per-record SEO:**
  - The `seo` schema gains `ogTitle` (≤ 70), `ogDescription` (≤ 200) and `twitterCard: "summary_large_image"|"summary"` (default large). These are optional, so seeded data parses unchanged and metadata output is unchanged when they are unset.
  - **SEO tab inside each editor** (page, service, article, builder), selected with `?tab=seo` and top Tabs Content / SEO. Form on the left. Aside on the right with:
    - **SERP preview** (MK style: "host › seg › seg", Google link colour `#1a0dab` light / `#8ab4f8` dark).
    - **Social card preview** (the uploaded image, otherwise `/og/<kind>/<id>`).
    - **Live checklist**, which runs the checks client-side on unsaved values.
  - The SEO overview sheet reuses the same `SeoPanel`.
- **SEO defaults** (`seo.defaults`, draft/publish; migration `0013_seo_defaults_robots` backfills):
  - `robots: "index"|"noindex"` (default index). `noindex` gives a `Disallow: /` robots.txt and a root `robots: { index:false, follow:false }`.
  - `verification: { google: string, bing: string }` (≤ 100, `[A-Za-z0-9_-]`), emitted as `metadata.verification` in `<head>`.
  - Refine: `titleTemplate` must contain `{title}`.
  - Aside **CrawlPreview** with tabs robots.txt and sitemap (URL count, first 20 locations). It notes that outside production, robots blocks everything.
- **Redirects:**
  - Migration `0014_redirects_admin`:
    - `is_active boolean not null default true`
    - `note text not null default ''` (≤ 200)
    - `last_hit_at timestamptz null`
    - `source text not null default 'manual'`, check in (`manual`, `auto`, `import`)
    - code check in (301, 302, 307, 308)
  - The resolver ignores inactive rows and sets `last_hit_at` with the hit. `recordMove` writes `source='auto'`.
  - UI: a Turn off / Turn on row action, Note, "Last hit / Never", an Automatic badge, and code select 301/302/307/308.
  - **CSV** `GET /redirects/export.csv` (columns `from,to,code,active,note,hits,last_hit_at,source`).
  - **CSV** `POST /redirects/import {csv, mode: "preview"|"commit"}`:
    - ≤ 1000 rows, ≤ 1 MB, RFC 4180.
    - Columns `from,to[,code][,note]`.
    - Each row is validated by `fromPathProblem` / `toPathProblem` / `checkRedirectChain` against existing rows plus earlier rows in the same import.
    - Preview returns `{ rows: [{ line, from, to, code, status: "create"|"update"|"error", message? }] }`.
    - Commit applies all rows in one transaction, or none if any error. It writes `source='import'` and one audit entry with counts.

### 7.2 D2 Marketing + events

- **Tracking** (`settings.tracking`; migration `0015_marketing` backfills):
  - Fields: `enabled` (master; still the condition for the consent banner, per the base ruling), `gtmId` / `gtmEnabled`, `ga4Id` / `ga4Enabled`, `metaPixelId` / `metaEnabled`.
  - IDs remain owner-only (`TRACKING_TAG_UPDATE`). The switches need `marketing:update`.
  - `channelStatus(t)` returns one of `"off"|"ready"|"missing-id"|"needs-banner"`:
    - `needs-banner` when the channel is on and the master is off
    - `missing-id` when the channel is on with no ID
  - The **status panel** aside shows one row per channel with a text label and icon (not colour alone) and the reason in plain words.
  - **Test event:** the "Send test event" button opens `<site>/?sp_tracking_test=<nonce>` in a new tab. When tracking is active **and** the visitor has consented, the public loader pushes `{event:"tracking_test", test_id:<nonce>}` and sets GA4 `debug_mode`. The panel explains where to look (GTM Preview, GA4 DebugView, Meta Test Events). Nothing is visible on the page.
- **Consent** (`settings.consent`):
  - Adds `version: int ≥ 1` (default 1; raising it re-asks every visitor because the cookie stores the version, see `CONSENT_VERSION`) and `reconsentMonths: 1..6` (default 6, the cookie max-age; replaces the constant 180 days).
  - **Live preview** aside fed by unsaved values, with a First layer / Customise toggle and working switches. It uses a pure `ConsentBannerView` split out of `components/consent/consent-banner.tsx` with byte-identical markup, so the consent-banner baselines stay at 0 px.
- **Custom code** (`settings.customCode`, owner-only for read and write):

  ```ts
  {
    disabled: boolean,                        // kill switch, default false
    allowedHosts: string[],                   // ≤ 20 hostnames
    snippets: Snippet[],                      // ≤ 20
  }
  Snippet = {
    id: uuid,
    name: string,                             // ≤ 60
    placement: "head" | "body",
    src: string | "",                         // https on allowedHosts, no credentials or port
    html: string | "",                        // ≤ 20 000; XOR with src
    category: "necessary" | "analytics" | "marketing",
    routes: string[],                         // ≤ 20 patterns `/` or `/blog/*`; empty = all
    enabled: boolean,
  }
  ```

  - Migration `0015_marketing` converts `headHtml` / `bodyEndHtml` into enabled `necessary` snippets ("Head code", "Body code"), which keeps today's behaviour.
  - The public loader runs a snippet only if `!disabled && enabled && routeMatches && (category === "necessary" || consent[category])`.
  - **Kill switch CLI** `pnpm custom-code:off` sets published `disabled=true`, audits as a system actor and invalidates the tag. The admin shows a banner "Custom code is switched off".
- **Event catalogue:** `lib/analytics/events.ts` `EVENT_CATALOGUE: { event, firesWhen, params, ga4, meta }[]` covering `page_view_virtual`, `lead_submitted`, `cta_click`, `phone_click`, `email_click`, `tracking_test` and (D4) `newsletter_sign_up`.
  - Page `/admin/marketing/events` (`marketing:read`) shows the table plus the note "Import `docs/gtm-container.json` into GTM".
  - **SPA page view:** the client tracking loader pushes `{event:"page_view_virtual", page_path, page_title}` on every pathname change after the first. It is invisible.
  - `docs/gtm-container.json` is a GTM export with a dataLayer variable and triggers per event.

### 7.3 D3 Leads, users, dashboard

- **Attribution:**
  - `lib/leads/attribution.ts` captures `{utmSource, utmMedium, utmCampaign, utmTerm, utmContent, referrer, landingPath, capturedAt}` once per session in `sessionStorage["sp_attribution"]` (first touch). The `referrer` is the origin plus path only.
  - The contact form sends `attribution` with the lead; its markup is unchanged.
  - Migration `0016_lead_attribution` adds `leads.attribution jsonb null`.
  - The value is shown in the lead drawer ("Source page, Referrer (Direct), UTM…") and added to CSV columns.
- **Leads screen:**
  - Top Tabs **Inbox / Spam** (`?folder=`); a **Board / Table** toggle (`?view=`, persisted per user in localStorage).
  - Board columns: new, contacted, qualified, won, lost. Dragging a card changes its status, with the dnd-kit keyboard sensor and an announced move.
  - Detail opens in a right **drawer** (`?lead=<id>`) with the existing detail content (timeline, notes, status, assignee). `/admin/leads/[id]` redirects to the drawer URL.
- **Users & roles:**
  - Top Tabs **People / Roles**.
  - Roles is a read-only **permission matrix** from `ROLE_GRANTS`: rows are resource · action, columns are roles, and cells use a check icon plus sr-text.
  - `/admin/users/[id]` stays.
- **Dashboard:**
  - KPI **deltas**: % vs the previous equal period. When the previous value is 0 it shows "new", not ∞.
  - **Week vs week** chart: Mon–Sun Europe/Dublin, this week vs last week.
  - **Content QA** list from `lib/content/qa.ts`. Rules:
    - placeholder contact values (`[email]`, `[phone]`, `example.com`, `000`)
    - placeholder copy (`lorem`, `TODO`, `TBC`, `[…]`)
    - legal pages (privacy, terms) unpublished or never edited since seed
    - records missing SEO or alt (from D1)
  - Content health in 3 buckets: Complete / Needs work / Missing SEO or alt.
  - Next-up adds "Reply to <name>" (oldest new lead) and "Turn on the AI assistant".

### 7.4 D4 Newsletter (MK-equivalent)

- **Table** `newsletter_subscribers` (migration `0017_newsletter`). Columns:
  - `id uuid v7`
  - `email text unique` (check lower)
  - `status text` (check pending|confirmed|unsubscribed)
  - `token_hash text unique null`, `token_expires_at`
  - `source_path text default '/'`, `consent_text text default ''`
  - `confirmed_at`, `unsubscribed_at`, `ip_hash`
  - `created_at`, `updated_at`
  - index `(status, created_at)`
- **Settings key** `newsletter` (draft/publish):
  - `placement: "off"|"blog"|"article"` (default **off**)
  - `doubleOptIn` (default true), `pendingDays` (default 30)
  - copy: eyebrow, title, subtitle, emailLabel, placeholder, button, success, errors {email, rateLimited, generic}
  - `confirmationEmail {subject, body}`
  - state pages `{confirmed, invalid, unsubscribe{…button}, unsubscribed}`
- **Public API:**
  - `POST /api/v1/public/newsletter` (201 always for valid input; honeypot `website`; Turnstile when configured; rate limit 5/10 min per IP and per email hash).
  - `GET /api/v1/public/newsletter/confirm?token=` → 303 to `/newsletter/confirmed` or `/newsletter/invalid`.
  - `POST /api/v1/public/newsletter/unsubscribe` (POST only) → 303 to `/newsletter/unsubscribed`.
  - Tokens: 32 random bytes; only the sha256 is stored; 7-day TTL.
  - Unsubscribe token: `<id>.<HMAC(newsletter-unsubscribe)[:32]>`, with a new `KeyPurpose` value `"newsletter"`.
  - Responses are identical whether the address is new, pending or confirmed. A confirmed row is never re-mailed.
  - Email `emails/newsletter-confirmation.tsx`, `MailTemplate` value `"newsletter-confirmation"`.
- **Public pages** `/newsletter/[state]` (confirmed, invalid, unsubscribe, unsubscribed): noindex, `referrer: no-referrer`. They reuse `PageHero` and the legal body styles; they are new URLs and do not touch existing baselines.
- **Public form:** `components/newsletter/newsletter-form.tsx`, styled only with existing site tokens and components (`Container`, `Eyebrow`, `SectionHeading`, `buttonClassName`). It renders in three places:
  - the builder block `newsletter` (any `/p/` page)
  - `placement === "blog"`: after the post list on `/blog`
  - `placement === "article"`: after the article body
  
  With `placement: "off"` (seeded) nothing renders, so the 40 baselines stay at 0 px. Turning a placement on visibly changes those pages, and the settings page says so in its help text. The form fires the `newsletter_sign_up` event.
- **Admin `/admin/newsletter`:**
  - Tabs Confirmed / Pending / Unsubscribed / All, plus search, paging (25), delete (`newsletter:delete`) and CSV export (`newsletter:export`; confirmed only, or all on the All tab).
  - Dashboard KPI "Newsletter subscribers" when `placement !== "off"` or the count is > 0.
  - The daily retention job purges stale pending rows. The lead CSV-by-email DSAR helper also lists and erases subscriber rows.

### 7.5 D5 Page builder (`/p/<slug>`)

- **Table** `builder_pages` (migration `0018_builder_pages`): `id, slug unique (slug regex), title, seo jsonb, ...versioned<BuilderDocument>(), timestamps, created_by`. Revisions use `entity_type 'builder-page'`. `PAGE_KEYS` and `loadSiteSources` are untouched.
- **Blocks** (`blocks/`). Each wraps an **existing** public component through the existing view builders in `templates/shared/views.ts`, so no public component changes:

  | Block | Component | Notes |
  |---|---|---|
  | `hero.page` | `PageHero` | first, max 1 |
  | `about` | `About` | from `settings.sections.about` |
  | `stats` | `Stats` | — |
  | `iconCards` | `IconCards` | — |
  | `services` | `Services` | from the services collection |
  | `whyChooseUs` | `WhyChooseUs` | — |
  | `enquireBanner` | `EnquireBanner` | — |
  | `clients` | `Clients` | — |
  | `team` | `Team` | — |
  | `blog` | `Blog` | latest N |
  | `departments` | `Departments` | — |
  | `contact` | `Contact` + form | max 1 |
  | `map` | `LocationMap` | — |
  | `richtext` | `ArticleBlocks` | legal body styles |
  | `newsletter` | D4 form | — |

  Each block is `{ id, type, anchor, hidden, data }`. `BuilderDocument = { blocks: Block[1..40] }`. `builderDocumentSchema` checks unique ids and anchors, `first` and `max`.
- **Public render:** `app/(site)/p/[slug]/page.tsx` wraps `<Suspense>` and `connection()` around `loadSiteSources()` (chrome) and `getBuilderPage(slug)` (`'use cache'`, tags `builder-page:<slug>` and `builder-pages`). It renders `SiteHeader / <main>blocks</main> / SiteFooter / HomeMotion / SiteLocale`.
- **Routing:**
  - The proxy `resolvePublicPath` treats `/p/<slug>` like a detail path: published (or draft cookie), otherwise a redirect lookup, otherwise a real 404.
  - The redirects `fromPathProblem` refuses `/p` and `/p/*` sources pointing at a live builder page.
  - Sitemap rows and the OG kind `builder` are added.
  - A slug change on a published page creates an automatic 301 (`source='auto'`). Deleting a page redirects to `/` only if the editor ticks "Redirect old address to home"; otherwise the page returns 404.
- **Admin:**
  - `/admin/pages` lists the "Site pages" (the 8 fixed ones, unchanged) and "Custom pages" (builder) with **New page** (title + slug).
  - `/admin/pages/custom/[id]` is the builder:
    - block library (filtered by `allowedOn`/`max`)
    - outline (dnd-kit reorder with keyboard, hide, duplicate, delete)
    - block form (SchemaForm from the block schema plus `blockMeta`)
    - block meta (anchor, hidden)
    - preview pane (desktop/tablet/phone, draft preview)
    - autosave (1.5 s, single flight, 409 → ConflictDialog)
    - History, Publish, Discard
    - SEO tab (`SeoPanel`)
  - **Copy to new page** on a fixed page creates a builder page whose blocks reproduce that template's sections with the same data. The fixed page and its route are never converted in place (risk §14).
- **Permissions:** `page` gains `create` and `delete`. Editor, owner and admin get them through `all("page")`.

---

## 8. Data model changes (migrations from 0010, fixed numbers)

| # | Name | Phase | Change |
|---|---|---|---|
| 0010 | `theme` | C2 | insert `settings` row `theme` (draft = published = `DEFAULT_THEME`, version 1) if missing |
| 0011 | `ai_settings` | C5 | jsonb-merge `integrations.ai` with `{baseUrl:"", extraInstructions:"", maxOutputTokens:1024, shareEnquiryDetails:{enabled:false, acknowledgedBy:null, acknowledgedAt:null}}` |
| 0012 | `media_alt` | D1.1 | `media.is_decorative`, `media.caption` |
| 0013 | `seo_defaults_robots` | D1.6 | jsonb-merge `seo.defaults` draft and published with `{robots:"index", verification:{google:"", bing:""}}` |
| 0014 | `redirects_admin` | D1.7 | `is_active`, `note`, `last_hit_at`, `source`; replace `redirects_code` check |
| 0015 | `marketing` | D2.1 | tracking per-channel backfill (`<ch>Enabled = enabled AND <ch>Id IS NOT NULL`); consent `{version:1, reconsentMonths:6}`; customCode → `{disabled:false, allowedHosts:[], snippets:[…converted]}` (draft and published) |
| 0016 | `lead_attribution` | D3.1 | `leads.attribution jsonb` |
| 0017 | `newsletter` | D4.1 | `newsletter_subscribers` table; insert `settings` row `newsletter` defaults (`placement:"off"`) |
| 0018 | `builder_pages` | D5.2 | `builder_pages` table |

- Migrations are generated with `pnpm db:generate`. Data backfills are custom SQL appended to the generated file, following the 0008/0009 pattern, with a `meta/_journal.json` entry.
- Each migration has an integration test in `tests/integration/db/`: it migrates an empty DB, inserts a pre-migration-shaped row where relevant, and asserts the backfill.
- Because the numbers are fixed, **tasks that add migrations are serial**. A parallel worktree that needs one must rebase and regenerate before merge.

## 9. Settings keys added

- `theme` (§6.2) and `newsletter` (§7.4) are added to `settingsSchemas`.
- `theme` is edited only through `/appearance`. It is excluded from `EDITABLE_SETTINGS_KEYS` and from `PUBLIC_SETTINGS_KEYS`; public reads go through `getPublishedTheme()`.
- `newsletter` is editable under Site settings by `settings:update` holders (owner, admin, editor). `placement` changes need `marketing:update` or `settings:update`.

## 10. Cache tags added

| Tag | Used for |
|---|---|
| `settings:theme` | the `theme` key (existing pattern) |
| `settings:newsletter` | the `newsletter` key (existing pattern) |
| `builderPages` = `"builder-pages"` | list, sitemap, misses |
| `builderPage(slug)` = `` `builder-page:${slug}` `` | one builder page |
| `newsletter` = `"newsletter"` | admin counts only |

## 11. Permissions

New statements:

```ts
page: ["read", "create", "update", "publish", "delete"]  // + create, delete
appearance: ["read", "update", "publish"]
newsletter: ["read", "export", "delete"]
```

| Role | appearance | newsletter | page create/delete |
|---|---|---|---|
| owner | all | all | yes |
| admin | all | all | yes |
| editor | read | — | yes |
| author | — | — | — |
| marketer | read | read, export | — |
| intake | — | — | — |
| viewer | read | — | — |

Unchanged:
- `customCode` is owner-only, and `/admin/design` uses it.
- Tag IDs are owner-only.
- AI settings use `integration:update`. The enquiry-details switch also needs `owner:manage`.
- The `tests/unit/permissions.test.ts` literal matrix is updated in the same task that changes `permissions.ts`.

## 12. Compatibility

- Old admin URLs are redirected (§5.2). Bookmarks and audit/notification links keep working.
- Public URLs are unchanged. New public URLs are `/p/<slug>` and `/newsletter/<state>`.
- APIs:
  - `/api/v1/admin/articles` etc. are unchanged; only admin page URLs move.
  - The integrations AI endpoint keeps working; the new settings page uses it.
  - `/api/v1/admin/marketing/:key` is unchanged, and the new fields are additive.

## 13. Testing

- **Unit (Vitest):**
  - nav registry, `permissionFor` and legacy redirects
  - theme engine: preset/CSS equality tests against `admin.css` and `globals.css`, default emits `""`, and contrast for every preset × mode
  - SEO checks
  - `channelStatus`, snippet gating, consent version, attribution capture
  - CSV parse/serialise, markdown renderer, builder reducer, block schemas, content QA, KPI deltas and week series
  - `tests/unit/permissions.test.ts`
- **DOM (`tests/dom`):** primitives, KpiCard, PillBarChart, SectionTabs, ColourField, ContrastPanel, ConsentBannerView (markup snapshot equals the banner), SeoPanel checklist, board keyboard move, markdown.
- **Integration (real Postgres):** each migration; services for appearance, AI settings and tools (permission filtering and PII gating), redirects import/export, newsletter (MK's five cases ported), builder pages (create/publish/slug-change redirect/delete) and leads attribution.
- **E2E (Playwright):**
  - old-URL redirects
  - ⌘K go-to and actions
  - appearance publish recolours the admin and reset restores it
  - site theme preview shows a draft and the published default renders no style tag
  - AI set-up CTA for the owner on a fresh DB
  - SEO tab in the editor, then a Fix link
  - redirect CSV round trip
  - tracking status and the test event (dataLayer probe)
  - leads board drag and drawer
  - newsletter subscribe, confirm (Mailpit) and unsubscribe on a `/p/` page
  - builder create, publish, view `/p/<slug>`, slug change and 301
  - role checks for each new permission
  - axe on every new screen
- **Visual:**
  - **public:** `pnpm test:visual tests/visual/public-pages.spec.ts tests/visual/consent-banner.spec.ts` stays at **0 px** after every task that touches `app/(site)`, `components/` (non-admin), `templates/`, `lib/analytics`, `proxy.ts` or `globals.css`
  - **admin:** baselines (`tests/visual/admin-*.spec.ts`, today 220 PNGs) are **fully re-shot** at the end of A, B, C and each D sub-phase (`pnpm test:visual:update tests/visual/admin-*.spec.ts`), with a reviewer eyeballing a contact sheet
  - **new:** `design-{light,dark}`, appearance, newsletter, builder, the events page, and one builder fixture page (`/p/visual-fixture`, created by `tests/visual/seed.ts`, never in `db:seed`)
- **Phase gate:** `pnpm lint && pnpm typecheck && pnpm test && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build && pnpm test:visual && pnpm test:e2e` (`pnpm db:up` first).

## 14. Risks

| Risk | Mitigation |
|---|---|
| Admin CSS decoupling drops a utility or variable some admin screen relied on from `globals.css` | A1 diff-checks the compiled admin CSS for every `var(--…)` used under `components/admin` and `app/(admin)`; the full admin re-shoot plus the a11y e2e |
| Derived palette fails AA somewhere | contrast test in A1 (and C1 for presets); lightness-only nudges recorded in §4.2 |
| Public theme style tag or newsletter placement leaks into seeded public pages | default theme emits `""` and the component returns `null`; `placement:"off"` seeded; public 0 px gate on every relevant task; unit test that seeded settings give no output |
| Route moves break deep links and e2e helpers | central `legacy-redirects.ts` plus an e2e that visits every old URL; grep gate for old paths in `components/`, `server/` and `tests/` |
| Global SectionTabs changes every tabbed screen layout | B3 re-shoot; per-layout rails deleted in the same task |
| `/p/` builder pages collide with redirects or 404 | proxy handles `/p/` explicitly before the redirect lookup; `fromPathProblem` rules; e2e for 404/301 |
| "Copy fixed page" output differs from the fixed template | it is a new page only; the fixed route is never swapped; a visual test compares `/p/copy-of-about` against `/about` and allows header/breadcrumb differences only |
| AI tools leak PII | `getEnquiryStats` returns aggregates only unless the owner switch is on (an integration test asserts no `@` or phone pattern in the output); tools are offered by role |
| Custom-code migration changes behaviour | converted snippets are `necessary` + enabled + all routes, giving the same execution as today; unit test on the converter |
| New deps fail the 14-day rule | versions are checked at install; otherwise use the newest qualifying version and record it |
| Parallel worktrees colliding on migrations, nav and permissions | serial markers in the plan; migration numbers fixed |
