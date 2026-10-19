/**
 * Old admin URLs → MK parity paths (spec §5.2), served by `next.config.ts`
 * `redirects()`: they run before `proxy.ts` and need no DB. All permanent
 * (308); Next passes the query string through. Sources are `/admin/...`
 * only, so no public URL ever matches.
 */
export type AdminLegacyRedirect = {
  source: `/admin/${string}`
  destination: `/admin/${string}`
  permanent: true
}

export const ADMIN_LEGACY_REDIRECTS: readonly AdminLegacyRedirect[] = [
  // B3: Growth and admin pages.
  {
    source: "/admin/marketing/tracking",
    destination: "/admin/marketing",
    permanent: true,
  },
  {
    source: "/admin/marketing/custom-code",
    destination: "/admin/marketing/code",
    permanent: true,
  },
  { source: "/admin/audit", destination: "/admin/activity", permanent: true },
  {
    source: "/admin/settings/integrations/ai",
    destination: "/admin/settings/ai-assistant",
    permanent: true,
  },
]
