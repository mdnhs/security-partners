import "server-only"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import type {
  ThemeDraftInput,
  ThemeDto,
  ThemeResetInput,
  ThemeRestoreInput,
  ThemeVersionInput,
} from "@/lib/schemas/api/theme"
import { checkTheme, describeIssue } from "@/lib/theme/checks"
import {
  AdminTheme,
  DEFAULT_THEME,
  ThemeConfig,
  type ThemeConfigValue,
} from "@/lib/theme/schema"
import { presetSiteTheme } from "@/lib/theme/site"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { tag } from "@/server/lib/cache-tags"
import { AppError, conflict, forbidden, notFound } from "@/server/lib/errors"
import {
  publish,
  restoreRevision,
  saveDraft,
  type VersionedAuditEvent,
  type VersionedRecord,
  type VersionedStore,
  versionedDto,
} from "@/server/lib/versioning"
import {
  findSettingsForEdit,
  type SettingsEditRow,
  updateSettingsIfVersion,
} from "@/server/modules/settings/repo"
import { readThemeOrDefault } from "@/server/modules/theme/queries"

/** The theme is the settings row "theme" (revisions: settings/theme). */
const KEY = "theme"

type Row = SettingsEditRow & VersionedRecord<ThemeConfigValue>

/**
 * settings rows lack status/publishedAt/scheduledAt (spec §5.4): derive them.
 * draft/published stay the raw stored values (as the settings store does):
 * publish re-validates the draft, so a corrupt or schema-drifted row is a
 * 422, never a silent publish of the default theme.
 */
function asVersioned(row: SettingsEditRow | null): Row | null {
  if (!row) return null
  return {
    ...row,
    draft: row.draft as ThemeConfigValue,
    published: row.published as ThemeConfigValue | null,
    status: row.published === null ? "draft" : "published",
    scheduledAt: null,
    publishedAt: null,
  }
}

/** The editor's view: an unparseable stored value shows as the default (logged). */
function toDto(row: Row): ThemeDto {
  // A null published value means "never published"; a null draft is a
  // damaged row (JSON null fits the jsonb NOT NULL column), so it is logged.
  if (row.draft === null)
    console.warn("[theme] stored theme invalid; using default", "draft is null")
  const draft = readThemeOrDefault(row.draft)
  return {
    draft,
    published:
      row.published === null ? null : readThemeOrDefault(row.published),
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
    issues: checkTheme(draft),
    hasDraft: versionedDto(row).dirty,
  }
}

function assertCan(actor: Actor, req: PermissionRequest) {
  if (!hasPermission(actor.roles, req)) throw forbidden()
}

/** Contrast gate: the client blocks publish too, the server decides. */
function assertPublishable(next: ThemeConfigValue) {
  const issues = checkTheme(next)
  if (issues.length > 0)
    throw new AppError(
      "VALIDATION_FAILED",
      "Fix the contrast issues before publishing",
      { fieldErrors: { draft: issues.map(describeIssue) } }
    )
}

type DraftAction =
  "appearance.update" | "appearance.discard" | "appearance.reset"

const AUDIT: Record<Exclude<VersionedAuditEvent, "draft_saved">, string> = {
  published: "appearance.publish",
  restored: "appearance.restore",
}

/** `draftAction` names what a draft write was (save, discard or reset) in the audit log. */
const storeFor = (
  draftAction: DraftAction = "appearance.update"
): VersionedStore<ThemeConfigValue, Row> => ({
  entityType: "settings",
  label: "Theme",
  schema: () => ThemeConfig,
  find: async (db, key) => asVersioned(await findSettingsForEdit(db, key)),
  update: async (db, key, version, patch) =>
    asVersioned(await updateSettingsIfVersion(db, key, version, patch)),
  authorizeWrite: (_row, next, action) => {
    if (action === "publish") assertPublishable(next)
  },
  auditAction: (event) =>
    event === "draft_saved" ? draftAction : AUDIT[event],
  tags: () => [tag.settings(KEY)],
  present: toDto,
})

async function currentRow(): Promise<Row> {
  const row = asVersioned(await findSettingsForEdit(getDb(), KEY))
  if (!row) throw notFound("Theme")
  return row
}

/**
 * Writes a draft built from the current one. A stale `version` is a 409
 * before the draft is built; saveDraft re-checks it inside the transaction.
 */
async function replaceDraft(
  actor: Actor,
  version: number,
  action: DraftAction,
  build: (current: Row) => ThemeConfigValue
): Promise<ThemeDto> {
  const current = await currentRow()
  if (current.version !== version) throw conflict(toDto(current))
  return toDto(
    await saveDraft(getDb(), storeFor(action), actor, KEY, {
      version,
      draft: build(current),
    })
  )
}

export async function getTheme(actor: Actor): Promise<ThemeDto> {
  assertCan(actor, { appearance: ["read"] })
  return toDto(await currentRow())
}

export async function saveThemeDraft(
  actor: Actor,
  input: ThemeDraftInput
): Promise<ThemeDto> {
  assertCan(actor, { appearance: ["update"] })
  return toDto(await saveDraft(getDb(), storeFor(), actor, KEY, input))
}

/** Draft → live: 422 while checkTheme reports issues; revision, audit, cache expiry. */
export async function publishTheme(
  actor: Actor,
  input: ThemeVersionInput
): Promise<ThemeDto> {
  assertCan(actor, { appearance: ["publish"] })
  return toDto(await publish(getDb(), storeFor(), actor, KEY, input))
}

/** The draft goes back to the live theme (the default when nothing is live). */
export async function discardThemeDraft(
  actor: Actor,
  input: ThemeVersionInput
): Promise<ThemeDto> {
  assertCan(actor, { appearance: ["update"] })
  return replaceDraft(
    actor,
    input.version,
    "appearance.discard",
    (current) => current.published ?? DEFAULT_THEME
  )
}

/** The scope's draft becomes the preset's defaults; the other scope is kept. */
export async function resetThemeDraft(
  actor: Actor,
  input: ThemeResetInput
): Promise<ThemeDto> {
  assertCan(actor, { appearance: ["update"] })
  const { preset, scope } = input
  return replaceDraft(actor, input.version, "appearance.reset", (current) => {
    // A JSON null draft keeps nothing: the kept scope takes its default
    // (saveDraft re-validates the whole draft either way).
    const kept = (current.draft ?? {}) as Partial<ThemeConfigValue>
    return {
      site:
        scope === "admin"
          ? (kept.site ?? DEFAULT_THEME.site)
          : presetSiteTheme(preset),
      admin:
        scope === "site"
          ? (kept.admin ?? DEFAULT_THEME.admin)
          : AdminTheme.parse({ preset }),
    }
  })
}

export async function restoreTheme(
  actor: Actor,
  input: ThemeRestoreInput
): Promise<ThemeDto> {
  assertCan(actor, { appearance: ["update"] })
  return toDto(await restoreRevision(getDb(), storeFor(), actor, KEY, input))
}
