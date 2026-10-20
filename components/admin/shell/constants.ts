// The cookie components/ui/sidebar.tsx writes (SIDEBAR_COOKIE_NAME there);
// the panel layout reads it so the first paint matches the saved state.
export const SIDEBAR_COOKIE = "sidebar_state"

/** The public site the admin edits: its origin and environment (spec §1.4). */
export type SiteInfo = {
  url: string
  env: "development" | "staging" | "production"
}

/**
 * The site's published logo for the sidebar brand (settings.site, media
 * resolved server-side by the panel layout). null = the SP chip.
 */
export type AdminBrand = {
  /** settings.site.name: the brand link's accessible name. */
  name: string
  logo: {
    src: string
    alt: string
    width: number | null
    height: number | null
  }
  /** settings.site.logoOnDark URL, shown in dark mode when set. */
  logoOnDark: string | null
  /** settings.site.logoAnimation URL (Lottie), looped over the logo. */
  animation: string | null
}

/** Until the layout passes the configured origin (tests, stories). */
export const DEFAULT_SITE: SiteInfo = { url: "/", env: "development" }

/** Circular icon buttons in the topbar (JW signature component 7). */
export const ICON_BUTTON = "size-11 rounded-full border-border bg-card"
