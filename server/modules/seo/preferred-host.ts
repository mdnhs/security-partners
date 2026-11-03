import "server-only"

import {
  PREFERRED_HOSTS,
  type PreferredHost,
} from "@/lib/schemas/settings/seo-defaults"
import { siteHostFrom } from "@/lib/seo/canonical-host"
import { getDb } from "@/server/db/client"
import { findSettingsRow } from "@/server/modules/settings/repo"

export type HostPolicy = { preferred: PreferredHost; siteHost: string | null }

/** A change in SEO › Defaults or Site takes effect within this long. */
export const HOST_POLICY_TTL_MS = 30_000
const OFF: HostPolicy = { preferred: "off", siteHost: null }
let cache: { value: HostPolicy; expires: number } | null = null

export const resetHostPolicyCache = () => {
  cache = null
}

const asPreferred = (value: unknown): PreferredHost =>
  PREFERRED_HOSTS.find((host) => host === value) ?? "off"

/**
 * The published preferred address and the host it applies to, for
 * proxy.ts. Rows are read unparsed (a value from before the field counts as
 * off); the answer is kept for HOST_POLICY_TTL_MS so a request does not pay
 * for a lookup each time. Fails open: any error means no redirect.
 */
export async function getHostPolicy(): Promise<HostPolicy> {
  const now = Date.now()
  if (cache && cache.expires > now) return cache.value
  try {
    const db = getDb()
    const [defaults, site] = await Promise.all([
      findSettingsRow(db, "seo.defaults"),
      findSettingsRow(db, "site"),
    ])
    const published = (row: typeof defaults) =>
      row?.published && typeof row.published === "object"
        ? (row.published as Record<string, unknown>)
        : {}
    const productionUrl = published(site).productionUrl
    const value: HostPolicy = {
      preferred: asPreferred(published(defaults).preferredHost),
      siteHost: siteHostFrom(
        typeof productionUrl === "string" ? productionUrl : null
      ),
    }
    cache = { value, expires: now + HOST_POLICY_TTL_MS }
    return value
  } catch {
    return OFF
  }
}
