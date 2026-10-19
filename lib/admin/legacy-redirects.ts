/**
 * Pre-MK admin addresses → their MK parity homes (spec §5.1). Served by
 * `next.config.ts` `redirects()` as 308s: they run before proxy.ts, need no
 * DB and keep the query string. Sources are all under `/admin/`, so no rule
 * can match a public URL.
 */
export type AdminLegacyRedirect = {
  source: `/admin/${string}`
  destination: `/admin/${string}`
  permanent: true
}

export const ADMIN_LEGACY_REDIRECTS: readonly AdminLegacyRedirect[] = [
  {
    source: "/admin/articles",
    destination: "/admin/insights",
    permanent: true,
  },
  {
    source: "/admin/articles/:path*",
    destination: "/admin/insights/:path*",
    permanent: true,
  },
  {
    source: "/admin/categories",
    destination: "/admin/insights/categories",
    permanent: true,
  },
  {
    source: "/admin/team",
    destination: "/admin/collections/team",
    permanent: true,
  },
  {
    source: "/admin/clients",
    destination: "/admin/collections/clients",
    permanent: true,
  },
  {
    source: "/admin/group-companies",
    destination: "/admin/collections/group-companies",
    permanent: true,
  },
]
