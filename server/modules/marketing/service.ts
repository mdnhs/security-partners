import "server-only"

import {
  GROWTH_SETTINGS,
  type GrowthSettingsKey,
  isGrowthSettingsKey,
} from "@/lib/admin/growth-settings"
import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import type { GrowthSettingsDto } from "@/lib/schemas/api/marketing"
import { settingsSchemas } from "@/lib/schemas/settings"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { tag } from "@/server/lib/cache-tags"
import { forbidden, notFound } from "@/server/lib/errors"
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

/** SEO defaults, tracking, consent and custom code only; per-key permission. */
function entryFor(actor: Actor, key: string, action: "read" | "update") {
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
  tags: (row) => [tag.settings(row.key as GrowthSettingsKey)],
  present: (row) => toDto(actor, row),
})

export async function getGrowthSettings(
  actor: Actor,
  key: string
): Promise<GrowthSettingsDto> {
  entryFor(actor, key, "read")
  const row = asVersioned(await findSettingsForEdit(getDb(), key))
  if (!row) throw notFound("Settings")
  return toDto(actor, row)
}

export async function saveGrowthSettingsDraft(
  actor: Actor,
  key: string,
  input: { draft: unknown; version: number }
): Promise<GrowthSettingsDto> {
  entryFor(actor, key, "update")
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
  entryFor(actor, key, "update")
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
  entryFor(actor, key, "update")
  return toDto(
    actor,
    await restoreRevision(getDb(), storeFor(actor), actor, key, input)
  )
}
