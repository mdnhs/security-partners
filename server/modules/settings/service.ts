import "server-only"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import {
  EDITABLE_SETTINGS_KEYS,
  type EditableSettingsKey,
  isEditableSettingsKey,
  SETTINGS_ENTRIES,
} from "@/lib/admin/settings-keys"
import type { SettingsDto, SettingsListItem } from "@/lib/schemas/api/settings"
import { settingsSchemas } from "@/lib/schemas/settings"
import { type DbOrTx, getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { tag } from "@/server/lib/cache-tags"
import { forbidden, notFound } from "@/server/lib/errors"
import type { SettingsKey, SettingsValue } from "@/server/lib/settings-store"
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
  findSettingsRow,
  listSettingsForEdit,
  type SettingsEditRow,
  updateSettingsIfVersion,
} from "./repo"

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

/**
 * Keys edited elsewhere (consent/tracking/customCode → Marketing, Phase 8;
 * seo.defaults → SEO; integrations → Phase 7) are 404 here (master 4.5).
 */
function entryFor(actor: Actor, key: string, action: "read" | "update") {
  if (!isEditableSettingsKey(key)) throw notFound("Settings")
  const entry = SETTINGS_ENTRIES[key]
  if (!can(actor, entry[action])) throw forbidden()
  return { key, entry }
}

function toDto(actor: Actor, row: Row): SettingsDto {
  const key = row.key as EditableSettingsKey
  const entry = SETTINGS_ENTRIES[key]
  return {
    key,
    label: entry.label,
    description: entry.description,
    group: entry.group,
    canEdit: can(actor, entry.update),
    ...versionedDto<unknown>(row),
  }
}

const storeFor = (actor: Actor): VersionedStore<unknown, Row> => ({
  entityType: "settings",
  label: "Settings",
  schema: (row) => settingsSchemas[row.key as EditableSettingsKey],
  find: async (db, key) => asVersioned(await findSettingsForEdit(db, key)),
  update: async (db, key, version, patch) =>
    asVersioned(await updateSettingsIfVersion(db, key, version, patch)),
  tags: (row) => [tag.settings(row.key as EditableSettingsKey)],
  present: (row) => toDto(actor, row),
})

export async function listSettings(
  actor: Actor
): Promise<{ items: SettingsListItem[] }> {
  const readable = EDITABLE_SETTINGS_KEYS.filter((key) =>
    can(actor, SETTINGS_ENTRIES[key].read)
  )
  const rows = await listSettingsForEdit(getDb(), readable)
  const byKey = new Map(rows.map((row) => [row.key, row]))
  const items: SettingsListItem[] = []
  for (const key of readable) {
    const row = asVersioned(byKey.get(key) ?? null)
    if (!row) continue
    const dto: Partial<SettingsDto> = toDto(actor, row)
    delete dto.draft
    delete dto.published
    items.push(dto as SettingsListItem)
  }
  return { items }
}

export async function getSettingsEntry(
  actor: Actor,
  key: string
): Promise<SettingsDto> {
  entryFor(actor, key, "read")
  const row = asVersioned(await findSettingsForEdit(getDb(), key))
  if (!row) throw notFound("Settings")
  return toDto(actor, row)
}

export async function saveSettingsDraft(
  actor: Actor,
  key: string,
  input: { draft: unknown; version: number }
): Promise<SettingsDto> {
  entryFor(actor, key, "update")
  return toDto(
    actor,
    await saveDraft(getDb(), storeFor(actor), actor, key, input)
  )
}

export async function publishSettings(
  actor: Actor,
  key: string,
  input: { version: number }
): Promise<SettingsDto> {
  entryFor(actor, key, "update")
  return toDto(
    actor,
    await publish(getDb(), storeFor(actor), actor, key, input)
  )
}

export async function restoreSettings(
  actor: Actor,
  key: string,
  input: { revisionId: string; version: number }
): Promise<SettingsDto> {
  entryFor(actor, key, "update")
  return toDto(
    actor,
    await restoreRevision(getDb(), storeFor(actor), actor, key, input)
  )
}

/**
 * Published value of a content settings key for server code that runs
 * outside the cached public queries (leads, jobs). null when unpublished
 * or when the stored value no longer matches its schema. Public readers
 * use the cached getPublishedSettings (settings/queries.ts) instead.
 */
export async function readPublishedSettings<K extends SettingsKey>(
  key: K,
  db: DbOrTx = getDb()
): Promise<SettingsValue<K> | null> {
  const row = await findSettingsRow(db, key)
  if (!row?.published) return null
  const parsed = settingsSchemas[key].safeParse(row.published)
  return parsed.success ? (parsed.data as SettingsValue<K>) : null
}
