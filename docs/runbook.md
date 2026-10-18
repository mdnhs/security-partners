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
- The site sends no Content-Security-Policy today. If one is added later, it
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
