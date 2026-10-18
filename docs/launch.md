# Launch checklist — security.raynx.ie

Operations detail for every item is in `docs/runbook.md`.

## Agent did

- Public site renders entirely from Postgres, pixel-identical to the static
  site (Playwright visual diff, 0 px at 1440 and 390 wide).
- Admin at `/admin`: pages, services, articles (draft → review → schedule →
  publish), team, clients, group companies, categories, media library,
  leads inbox + CSV export, SEO (metadata, JSON-LD, OG images, sitemap,
  robots, redirects), marketing (tracking, consent banner, custom code),
  settings, integrations, users (invite, roles, 2FA, sessions, "View as"),
  audit log, AI assistant, dashboard.
- Seven roles (owner, admin, editor, author, marketer, intake, viewer)
  enforced in the UI and the API.
- Email (SMTP), media (Cloudflare R2, local disk until then), Turnstile and
  AI keys are configured in the admin and stored encrypted.
- Daily backups with a restore drill, secret rotation, environment sync
  (`db:sync`), owner recovery, demo-account removal (`demo:remove`).
- CI (lint, types, unit, integration, build without env, E2E on the
  standalone server, Docker image smoke test incl. backup + restore drill)
  gates every deploy from `main`.
- Dashboard warnings for failing background jobs and for unreadable
  Turnstile settings ("Spam protection is off").
- Security headers, a non-blocking Content-Security-Policy, production
  guards on the three environment variables, a production-only dependency
  audit (`pnpm audit:deps`).
- Runbook: `docs/runbook.md`.

Known limitations that remain are listed in the runbook ("Known
limitations"), e.g. visual tests run on macOS only and stopping background
jobs on shutdown is best effort.

## Owner must do

- [ ] GitHub: repository secrets `DOKPLOY_URL` and `DOKPLOY_API_KEY`. If
      deploys should wait for an approval, add required reviewers under
      Settings → Environments → `production` (the deploy job uses that
      environment).
- [ ] DNS: `security.raynx.ie` → the Dokploy server (Traefik gets the
      certificate).
- [ ] Dokploy: Postgres 17 database service; app on `dokploy-network` so it
      reaches the database; the three variables set (runbook "First
      production deploy"). Keep `BETTER_AUTH_SECRET` in the password manager.
- [ ] Traefik: leave `forwardedHeaders` untrusted on the public entrypoint
      (no `insecure`, no `trustedIPs`) so Traefik overwrites
      `X-Forwarded-For`; never publish port 3000 on the host. Otherwise the
      sign-in and enquiry rate limits can be bypassed. If Cloudflare proxies
      the site, trust only Cloudflare's IP ranges (runbook "Client IPs and
      Traefik").
- [ ] Traefik: add a `rateLimit` middleware for `/og/*`,
      `/api/v1/admin/ai/*` and `/api/v1/admin/preview` (runbook "Rate limits
      at the proxy").
- [ ] First deploy: seed content once (`seed.mjs --allow-production`), then
      `admin-create` the first owner **once** (every run creates another
      owner), set the password, turn on 2FA.
- [ ] Settings ▸ Integrations ▸ SMTP: real credentials; run "Test".
- [ ] Settings ▸ Leads: a real inbox in recipients (default
      `info@securitypartnersltd.com`); retention (default 24 months).
- [ ] Cloudflare R2: a **private** bucket (EU jurisdiction if wanted; no
      public URL needed — media is served through the site), an API token
      with **Object Read & Write** on that bucket; save in Settings ▸
      Integrations ▸ R2, "Test", then "Move uploads to R2". Backups then go
      to `backups/` in the same bucket.
- [ ] Turnstile: create the widget in **Invisible** mode for the domain;
      site + secret key in Settings ▸ Integrations ▸ Turnstile; "Test".
      Visitor acknowledgement emails are sent only when Turnstile is on and
      verified the submission (otherwise the form could be used to send mail
      to any address).
- [ ] Tracking: GTM / GA4 / Meta pixel IDs and consent banner copy in
      Marketing; turn tracking on only when ready (the banner appears then).
      Only an owner can change the tag IDs: a GTM container can run any
      script, and the admin shares the public site's origin, so a tag could
      act with a signed-in admin's session. Marketers keep the on/off switch
      and the banner copy. Owner decision: serving the admin and API from a
      separate origin (e.g. an `admin.` subdomain) is the stronger long-term
      fix for custom code and tags alike.
- [ ] Custom code (Marketing ▸ Custom code, owner only): it runs on every
      page **without** waiting for cookie consent. Only paste code that sets
      no non-essential cookies, or put consent-dependent tags under Tracking
      instead. Keeping custom code compliant is the owner's responsibility.
- [ ] Optional: AI provider key and allowed roles (Settings ▸ Integrations ▸
      AI); sign a data processing agreement with the provider first (see
      "Owner must confirm").
- [ ] Replace the placeholder Privacy and Terms copy (Pages ▸ Privacy/Terms).
      The privacy policy must cover: enquiry handling (what is stored, why,
      the 24-month retention, who receives it); Cloudflare (Turnstile
      receives the visitor's IP address) and, if used, the AI provider as
      processors; Cloudflare R2 as storage for media and backups; the
      tracking tools and cookies.
- [ ] Invite staff with the right roles; owners turn on 2FA.
- [ ] Remove demo accounts if `demo:seed` ever ran on production:
      `node scripts/dist/demo-remove.mjs` (`pnpm demo:remove` locally).
- [ ] Before each deploy that changes the database, take a backup
      (`node scripts/dist/backup.mjs`).
- [ ] After a day: the dashboard shows no failing jobs and a backup exists;
      run `restore-drill` once (the database user needs `CREATEDB`), then
      monthly.
- [ ] Keep Traefik access-log retention short: the lead export for a
      data-subject request puts the person's email in the URL.
- [ ] SEO ▸ Defaults: shorten the seeded default description (163
      characters; search engines show about 160).
- [ ] Optional: move the 41 MB of visual-test PNGs to Git LFS.

## Owner must confirm

- **Consent for enquiries:** the contact form has no consent checkbox (the
  design is frozen). Enquiries are stored with `consent: true`, which means
  only "the visitor submitted the form to be contacted about this enquiry"
  — never consent to marketing. The legal basis is replying to the request
  (GDPR Art. 6(1)(b), or legitimate interest, Art. 6(1)(f)). Confirm this
  basis and that the privacy policy explains it (or approve a visible
  consent line, which changes the form design).
- **Cloudflare as GDPR processor:** Turnstile receives each enquirer's IP
  address and browser signals; R2 stores media and backups. Confirm
  Cloudflare as a processor (Cloudflare's data processing addendum) and name
  it in the privacy policy.
- **AI provider as GDPR processor:** when staff use the assistant on a lead,
  the enquiry text and the person's name are sent to the chosen AI provider
  (email and phone are left out); on other screens, the text of that screen
  is sent. The provider becomes a GDPR processor: confirm, or keep the
  assistant off / away from the intake role.
- **AI conversations:** kept until a user deletes them (no automatic
  purge), and an admin using "View as" can read that user's conversations.
  Confirm, or ask for a retention purge.
- **Backups:** they share the media bucket and API token and are encrypted
  at rest only by R2. Confirm, or provide a separate bucket/token or ask for
  client-side encryption.
- **Staging and search engines:** the app does not block indexing of a
  staging copy. Decide whether staging is protected (HTTP auth or proxy
  rule) — `db:sync` copies real leads there.
- **Data to correct or confirm on the site:**
  - office hours are written two ways: "Monday–Friday, 9am to 6pm" (header)
    and "Monday–Friday: 9am to 6pm" (contact card);
  - the HR phone "(085) 8062369" has the same digits as Cleaning Partners
    "085 806 2369";
  - the Accounts line "Tel: (057) 8697670 Ext 3" formats the office number
    differently from "057 8697670" elsewhere.
- **Cookie banner look:** the category pills in the consent banner are navy
  text on green (changed from the design for WCAG AA contrast), and the
  default button hover is the primary colour at 90 %. Confirm the look.
- Decisions taken on your behalf (spec §1.3, D1–D10), e.g. Postgres as a
  Dokploy service, Turnstile invisible only, 24-month lead retention,
  Europe/Dublin time, shared sections edited once.
- Sessions last 7 days (extended while used); passwords need 12+
  characters.
