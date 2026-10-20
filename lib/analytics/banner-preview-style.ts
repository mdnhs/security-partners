// The public site's brand colours as CSS custom properties, for the admin's
// consent-banner preview: the admin stylesheet never reads the public tokens
// (spec 2026-10-19-mk-parity §4.1), so the preview's frame sets them itself.
// Derived from SP_SITE (lib/theme/presets.ts, verbatim from app/globals.css
// @theme; tests/unit/analytics/banner-preview-style.test.ts keeps them equal).
import { SP_SITE } from "@/lib/theme/presets"
import type { SiteToken } from "@/lib/theme/tokens"

export const BANNER_PREVIEW_STYLE = Object.fromEntries(
  (Object.entries(SP_SITE) as [SiteToken, string][]).map(([token, value]) => [
    `--color-${token}`,
    value,
  ])
) as Readonly<Record<`--color-${SiteToken}`, string>>
