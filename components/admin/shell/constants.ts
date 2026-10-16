// The cookie components/ui/sidebar.tsx writes (SIDEBAR_COOKIE_NAME there);
// the panel layout reads it so the first paint matches the saved state.
export const SIDEBAR_COOKIE = "sidebar_state"

/** The public site the admin edits: its origin and environment (spec §1.4). */
export type SiteInfo = {
  url: string
  env: "development" | "staging" | "production"
}

/** Until the layout passes the configured origin (tests, stories). */
export const DEFAULT_SITE: SiteInfo = { url: "/", env: "development" }
