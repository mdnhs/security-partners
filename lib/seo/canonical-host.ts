// The site answers on four addresses (http/https, with/without www). Search
// engines treat each as a separate site, so the admin picks one
// (seo.defaults.preferredHost) and the proxy sends the others to it with a 301.
// Isomorphic: no server imports.
import type { PreferredHost } from "@/lib/schemas/settings/seo-defaults"

import { originOf } from "./urls"

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/

export const bareHost = (hostname: string): string =>
  hostname.toLowerCase().replace(/^www\./, "")

/**
 * The host the site lives on: settings.site.productionUrl without www. Only
 * this site's own two hosts (bare and www) are ever redirected, so staging,
 * previews, IPs, localhost and health checks are left alone. Null when
 * productionUrl is unset.
 */
export function siteHostFrom(productionUrl: string | null | undefined) {
  const origin = originOf(productionUrl)
  return origin ? bareHost(new URL(origin).hostname) : null
}

export type CanonicalHostInput = {
  /** Request Host (or x-forwarded-host), optionally with a port. */
  host: string | null
  /**
   * x-forwarded-proto when a reverse proxy set it; null when unknown (the
   * protocol is then left alone, so a proxy that hides it can never cause a
   * redirect loop).
   */
  proto: string | null
  preferred: PreferredHost
  siteHost: string | null
  pathAndSearch: string
}

/**
 * The https address the request should have been made to, or null when it is
 * already right, the feature is off, or the host is not this site's own.
 */
export function canonicalHostRedirect(i: CanonicalHostInput): string | null {
  if (i.preferred === "off" || !i.siteHost || !i.host) return null
  const first = i.host.split(",")[0]!.trim().toLowerCase()
  const hostname = first.replace(/:\d+$/, "")
  if (!hostname || IPV4.test(hostname) || hostname.startsWith("[")) return null
  if (bareHost(hostname) !== i.siteHost) return null
  const wanted = i.preferred === "www" ? `www.${i.siteHost}` : i.siteHost
  const proto = i.proto?.split(",")[0]!.trim().toLowerCase() ?? null
  if (hostname === wanted && proto !== "http") return null
  if (!i.pathAndSearch.startsWith("/") || i.pathAndSearch.startsWith("//"))
    return null
  return `https://${wanted}${i.pathAndSearch}`
}
