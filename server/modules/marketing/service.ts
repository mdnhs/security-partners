import "server-only"

import {
  GROWTH_SETTINGS,
  type GrowthSettingsKey,
  isGrowthSettingsKey,
  TRACKING_TAG_UPDATE,
  trackingTagsChanged,
} from "@/lib/admin/growth-settings"
import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import type { GrowthSettingsDto } from "@/lib/schemas/api/marketing"
import { settingsSchemas } from "@/lib/schemas/settings"
import { consentSettings } from "@/lib/schemas/settings/consent"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { tag } from "@/server/lib/cache-tags"
import { AppError, forbidden, notFound } from "@/server/lib/errors"
import {
  publish,
  restoreRevision,
  saveDraft,
  type VersionedRecord,
  type VersionedStore,
  versionedDto,
} from "@/server/lib/versioning"
import {
  findSettingsForEdit,
  type SettingsEditRow,
  updateSettingsIfVersion,
} from "@/server/modules/settings/repo"

type Row = SettingsEditRow & VersionedRecord<unknown>

/** settings rows lack status/publishedAt/scheduledAt (spec §5.4): derive them. */
function asVersioned(row: SettingsEditRow | null): Row | null {
  if (!row) return null
  return {
    ...row,
    status: row.published === null ? "draft" : "published",
    scheduledAt: null,
    publishedAt: null,
  }
}

const can = (actor: Actor, req: PermissionRequest) =>
  hasPermission(actor.roles, req)

/** SEO defaults, tracking, consent and custom code only; per-key permission (404, then 403). */
export function authorizeGrowthSettings(
  actor: Actor,
  key: string,
  action: "read" | "update"
) {
  if (!isGrowthSettingsKey(key)) throw notFound("Settings")
  if (!can(actor, GROWTH_SETTINGS[key][action])) throw forbidden()
  return key
}

function toDto(actor: Actor, row: Row): GrowthSettingsDto {
  const key = row.key as GrowthSettingsKey
  const entry = GROWTH_SETTINGS[key]
  return {
    key,
    label: entry.label,
    description: entry.description,
    canEdit: can(actor, entry.update),
    ...versionedDto<unknown>(row),
  }
}

const storeFor = (actor: Actor): VersionedStore<unknown, Row> => ({
  entityType: "settings",
  label: "Settings",
  schema: (row) => settingsSchemas[row.key as GrowthSettingsKey],
  find: async (db, key) => asVersioned(await findSettingsForEdit(db, key)),
  update: async (db, key, version, patch) =>
    asVersioned(await updateSettingsIfVersion(db, key, version, patch)),
  authorizeWrite: (row, next, action) => {
    assertMayChangeTrackingTags(actor, row, next, action)
    assertConsentVersionKept(row, next)
  },
  tags: (row) => [tag.settings(row.key as GrowthSettingsKey)],
  present: (row) => toDto(actor, row),
})

/**
 * Final review I1: a tracking tag ID loads third-party script on the
 * admin's origin, so only customCode:update (owner) may change one. The
 * draft is compared with the current draft (save, restore) and the value
 * going live with the live one (publish), so a marketer can still edit the
 * other fields and publish a draft whose IDs an owner set and published.
 */
function assertMayChangeTrackingTags(
  actor: Actor,
  row: Row,
  next: unknown,
  action: "draft" | "publish" | "restore"
) {
  if (row.key !== "tracking" || can(actor, TRACKING_TAG_UPDATE)) return
  const before = action === "publish" ? row.published : row.draft
  if (trackingTagsChanged(before, next))
    throw new AppError(
      "FORBIDDEN",
      "Only an owner can change the Tag Manager, Analytics or Meta Pixel ID"
    )
}

/**
 * Review D2.2 I1: a consent version below the published one would make
 * cookies stored under that older version count again (consent given for
 * other purposes revived without asking). Save, publish and restore all
 * refuse it; `next` is already parsed, so a blank field arrives as the
 * schema default 1 and is refused too. Unpublished consent has no floor.
 */
function assertConsentVersionKept(row: Row, next: unknown) {
  if (row.key !== "consent") return
  const live = consentSettings.safeParse(row.published)
  if (!live.success) return
  const version = (next as { version?: unknown } | null)?.version
  if (typeof version !== "number" || version >= live.data.version) return
  const message = `Can't go below ${live.data.version}, the published version: visitors who chose under an older version would count as having consented.`
  throw new AppError("VALIDATION_FAILED", "Some fields need attention", {
    fieldErrors: { version: [message] },
  })
}

export async function getGrowthSettings(
  actor: Actor,
  key: string
): Promise<GrowthSettingsDto> {
  authorizeGrowthSettings(actor, key, "read")
  const row = asVersioned(await findSettingsForEdit(getDb(), key))
  if (!row) throw notFound("Settings")
  return toDto(actor, row)
}

export async function saveGrowthSettingsDraft(
  actor: Actor,
  key: string,
  input: { draft: unknown; version: number }
): Promise<GrowthSettingsDto> {
  authorizeGrowthSettings(actor, key, "update")
  return toDto(
    actor,
    await saveDraft(getDb(), storeFor(actor), actor, key, input)
  )
}

export async function publishGrowthSettings(
  actor: Actor,
  key: string,
  input: { version: number }
): Promise<GrowthSettingsDto> {
  authorizeGrowthSettings(actor, key, "update")
  return toDto(
    actor,
    await publish(getDb(), storeFor(actor), actor, key, input)
  )
}

export async function restoreGrowthSettings(
  actor: Actor,
  key: string,
  input: { revisionId: string; version: number }
): Promise<GrowthSettingsDto> {
  authorizeGrowthSettings(actor, key, "update")
  return toDto(
    actor,
    await restoreRevision(getDb(), storeFor(actor), actor, key, input)
  )
}
