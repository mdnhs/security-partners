// The public site's brand colours as CSS custom properties, for the admin's
// consent-banner preview: the admin stylesheet never reads the public tokens
// (spec 2026-10-19-mk-parity §4.1), so the preview's frame sets them itself.
// Verbatim from app/globals.css @theme (tests/unit/analytics/
// banner-preview-style.test.ts keeps them equal). Once C1's lib/theme/
// presets.ts is on the branch this is derived from SP_SITE instead.

export const BANNER_PREVIEW_STYLE = {
  "--color-brand-navy": "#0d1b36",
  "--color-brand-blue": "#2751a3",
  "--color-brand-blue-deep": "#03428f",
  "--color-brand-green": "#67bd31",
  "--color-brand-green-dark": "#4e9a22",
  "--color-brand-mint": "#eef6e8",
  "--color-brand-surface": "#f5f7fb",
  "--color-brand-line": "#e3e8f2",
  "--color-brand-ink": "#4a5568",
  "--color-brand-muted": "#718096",
  "--color-brand-placeholder": "#a0aec0",
  "--color-brand-map": "#e8eae6",
} as const satisfies Record<`--color-brand-${string}`, string>
