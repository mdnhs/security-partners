"use client"

import { SP_ADMIN_DARK, SP_ADMIN_LIGHT } from "@/lib/theme/sp-admin"

/**
 * Last-resort boundary for a failing root layout (final review I7; Next's
 * `global-error`): it replaces the whole document, so no app stylesheet or
 * font is loaded. The admin kit's card is reproduced with inline styles and
 * the admin tokens from lib/theme/sp-admin.ts (light, and dark under
 * prefers-color-scheme). Kept
 * self-contained on purpose: importing admin.css here would put it on
 * every page, public site included.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <html lang="en-IE">
      <head>
        <title>Something went wrong · Security Partners</title>
        <meta name="robots" content="noindex" />
        <style>{CSS}</style>
      </head>
      <body>
        <main>
          <section role="alert">
            <h1>Something went wrong</h1>
            <p>
              This page didn&apos;t load. Please try again in a moment.
              {error.digest ? (
                <>
                  {" "}
                  Reference <code>{error.digest}</code>.
                </>
              ) : null}
            </p>
            <button type="button" onClick={() => retry()}>
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  )
}

const L = SP_ADMIN_LIGHT
const D = { ...SP_ADMIN_LIGHT, ...SP_ADMIN_DARK }

const CSS = `
:root {
  color-scheme: light dark;
  --canvas: ${L.sidebar}; --card: ${L.card}; --fg: ${L["card-foreground"]}; --muted: ${L["muted-foreground"]};
  --primary: ${L.primary}; --on-primary: ${L["primary-foreground"]}; --ring: ${L.ring};
}
@media (prefers-color-scheme: dark) {
  :root {
    --canvas: ${D.sidebar}; --card: ${D.card}; --fg: ${D["card-foreground"]}; --muted: ${D["muted-foreground"]};
    --primary: ${D.primary}; --on-primary: ${D["primary-foreground"]}; --ring: ${D.ring};
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; min-height: 100svh; background: var(--canvas); color: var(--fg);
  font-family: "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
main { display: flex; min-height: 100svh; align-items: center; justify-content: center; padding: 16px; }
section {
  display: flex; flex-direction: column; align-items: center; gap: 16px;
  max-width: 28rem; padding: 48px 32px; border-radius: 1.375rem;
  background: var(--card); text-align: center;
}
h1 { margin: 0; font-size: 1.25rem; font-weight: 700; }
p { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--muted); }
code { font-family: ui-monospace, monospace; }
button {
  min-height: 44px; padding: 0 20px; border: 0; border-radius: 0.75rem;
  background: var(--primary); color: var(--on-primary);
  font: inherit; font-size: 0.875rem; font-weight: 600; cursor: pointer;
}
button:focus-visible { outline: 3px solid var(--ring); outline-offset: 2px; }
`
