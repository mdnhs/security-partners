# Legal pages CMS (modelled on VANTAGE's legal-pages-cms)

Goal: admins create, edit, publish, reorder and delete legal pages (Cookie
Policy, Acceptable Use, …) from the admin panel; every published one is served
at `/<slug>` and linked from the footer, with no developer involved.
`/privacy` and `/terms` stay the fixed CMS pages they are today and keep their
footer links; legal pages are appended after them.

## Decisions
- Own table `legal_pages` (id, slug, title, sort_order, versioned draft/published,
  created_by, timestamps). The document is the existing `legalTemplate`
  (hero + rich text body), so a legal page looks exactly like /privacy and /terms
  and is edited with the same schema form and `VersionedEditor` (drafts, publish,
  revisions, optimistic lock).
- URL `/<slug>` (root level). Slugs are `a-z0-9-` only, <= 60, never a reserved
  or static route (lib/legal-slug.ts, checked against the app dirs in a unit
  test), never a live redirect source (blocked, names the redirect).
- Permissions reuse `page` (read/create/update/publish/delete).
- Renaming a published page records a 301 from the old address (recordMove).
- "Last updated" = `published_at` (bumped by publish; reorder and slug edits
  never touch it).
- Footer reads published pages through one cached query tagged `legal-pages`;
  a database failure is never cached as "no pages".
- proxy.ts answers an unknown root address with a real 404 before streaming
  (as for /services/<slug>), so `app/(site)/[slug]` never serves a 200 for nothing.
- Sitemap lists published legal pages. Per-page SEO overrides are out of scope
  (title and hero intro feed the metadata).

## Phases
1. Schema, migration, slug rules, API types.
2. Repo, service, routes (create / get / draft / publish / restore / meta / order / delete).
3. Public: queries, `[slug]` route, proxy and redirects "live page" rules, footer, sitemap.
4. Admin: nav entry, list (reorder, new, delete), editor.
5. Tests (unit, integration) and verification.
