# Runbook

## Custom code and Content-Security-Policy

Marketing › Custom code (owner only) adds the published `settings.customCode`
snippets to every public page. Each snippet is sent as one inline loader
`<script id="sp-custom-code-head|body">` that parses the HTML and appends it
to `<head>` / the end of `<body>` after the page loads, so its scripts run
once per page load. Drafts never run on the site; publishing applies at once.

- Only paste code from vendors you trust: it runs with full access to every
  visitor's page and is not covered by the cookie banner. Consent-dependent
  tags (Google, Meta) belong under Marketing › Tracking.
- Verify domains by DNS (Google Search Console, Meta Business), not with a
  `<meta>` tag: the tag only exists after JavaScript runs.
- Tracking (Marketing › Tracking) loads nothing until a visitor consents:
  analytics consent loads Google Tag Manager / Google Analytics 4 (after the
  Google Consent Mode defaults, all denied), marketing consent loads the Meta
  Pixel. The choice is kept in the `sp_consent` cookie for 6 months; the
  "Cookie settings" button reopens the banner, and withdrawing a category
  clears the GA/Meta cookies and reloads the page.
- Pages send a Content-Security-Policy that restricts no source:
  `base-uri 'self'; object-src 'none'; frame-ancestors 'self'` (`'none'` under
  `/admin`, next.config.ts). Public pages are Cache Components static shells,
  so a per-request nonce is not possible without making every page dynamic
  (Next CSP guide). If a stricter policy (`script-src` etc.) is added later, it
  must allow:
  - `script-src`: the inline loaders (a per-request nonce on
    `#sp-custom-code-*`, or `'unsafe-inline'`), Next's own scripts (inline
    bootstrap and the `<html class="js">` snippet in the site layout),
    `https://challenges.cloudflare.com` (Cloudflare Turnstile on the contact
    form), and the hosts the snippets load from; for Tracking also
    `https://www.googletagmanager.com` and `https://connect.facebook.net`.
  - `connect-src` / `img-src`: `https://*.google-analytics.com`,
    `https://*.analytics.google.com`, `https://*.googletagmanager.com`,
    `https://www.facebook.com` (pixel beacons), plus any snippet endpoints.
  - `frame-src`: `https://challenges.cloudflare.com` (the Turnstile widget
    is an iframe) and whatever the snippets embed.
- To remove everything quickly: clear both fields and publish (no deploy).
  To stop all tracking at once: switch "Load tracking" off under
  Marketing › Tracking and publish (the banner disappears too).

## Rate limits at the proxy (Traefik)

The app limits only sign-in, two-factor and password resets (Better Auth,
production only), the public enquiry form (`public_rate_limits`) and AI chat
(30 messages per user per 10 minutes). Add a Traefik `rateLimit` middleware in
Dokploy for the paths that cost CPU or money per request and have no limit of
their own:

- `/og/*` — share-card images are rendered on demand (cached afterwards, but
  every new URL variant renders once);
- `/api/v1/admin/ai/*` — beyond the per-user chat limit, a burst limit per
  client IP protects the provider bill if a session is stolen;
- `/api/v1/admin/preview` — every call switches draft mode on and renders an
  uncached page.

A per-IP average of about 10 requests/second with a burst of 20 leaves normal
use untouched. This only works if Traefik sets the client IP itself (no
`forwardedHeaders.insecure` or trusted IPs on the public entrypoint).

## Dependency audit

`pnpm audit:deps` runs `pnpm audit --prod --audit-level high`. It checks
**production dependencies only** — the packages the standalone image ships.
Dev and build tools (drizzle-kit, eslint, shadcn, vitest, playwright) are not
covered by the gate. Their advisories (e.g. the moderate `esbuild` advisory via
drizzle-kit) only affect the developer machine and CI. Run a full
`pnpm audit` before a release and review anything high or critical by hand.
