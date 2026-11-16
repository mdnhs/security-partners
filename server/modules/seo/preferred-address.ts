import "server-only"

import { hasPermission } from "@/lib/auth/permissions"
import type { PreferredAddressDto } from "@/lib/schemas/api/seo"
import {
  PREFERRED_HOSTS,
  type PreferredHost,
} from "@/lib/schemas/settings/seo-defaults"
import { siteHostFrom } from "@/lib/seo/canonical-host"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import { invalidate, tag } from "@/server/lib/cache-tags"
import { AppError, forbidden } from "@/server/lib/errors"
import {
  findSettingsRow,
  mergeIntoSettingsLive,
} from "@/server/modules/settings/repo"

import { resetHostPolicyCache } from "./preferred-host"

// SEO › Canonical URLs: the site's main address (seo.defaults.preferredHost).
// The proxy 301s the other three of http/https × with/without www to it
// (lib/seo/canonical-host.ts). Saved live, like a redirect: draft and
// published change together, so the editor's draft never undoes it.

const published = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {}

const asPreferred = (value: unknown): PreferredHost =>
  PREFERRED_HOSTS.find((host) => host === value) ?? "off"

/** GET /seo/preferred-address: the live choice and the host it applies to. */
export async function getPreferredAddress(
  actor: Actor
): Promise<PreferredAddressDto> {
  if (!hasPermission(actor.roles, { seo: ["read"] })) throw forbidden()
  const db = getDb()
  const [defaults, site] = await Promise.all([
    findSettingsRow(db, "seo.defaults"),
    findSettingsRow(db, "site"),
  ])
  const productionUrl = published(site?.published).productionUrl
  return {
    preferredHost: asPreferred(published(defaults?.published).preferredHost),
    siteHost: siteHostFrom(
      typeof productionUrl === "string" ? productionUrl : null
    ),
  }
}

/** PUT /seo/preferred-address: live at once (the proxy reads it within a minute). */
export async function savePreferredAddress(
  actor: Actor,
  preferredHost: PreferredHost
): Promise<PreferredAddressDto> {
  if (!hasPermission(actor.roles, { seo: ["update"] })) throw forbidden()
  const current = await getPreferredAddress(actor)
  if (preferredHost !== "off" && !current.siteHost)
    throw new AppError(
      "VALIDATION_FAILED",
      "Set the site's production URL first (Settings › Site)",
      {
        fieldErrors: { preferredHost: ["Set the site's production URL first"] },
      }
    )
  await getDb().transaction(async (tx) => {
    const found = await mergeIntoSettingsLive(
      tx,
      "seo.defaults",
      { preferredHost },
      actor.userId
    )
    if (!found) throw new AppError("NOT_FOUND", "SEO defaults not found")
    await writeAudit(tx, actor, {
      action: "seo.preferred_address_updated",
      entityType: "settings",
      entityId: "seo.defaults",
      diff: { preferredHost: [current.preferredHost, preferredHost] },
    })
  })
  resetHostPolicyCache()
  invalidate(tag.settings("seo.defaults"))
  return { preferredHost, siteHost: current.siteHost }
}
