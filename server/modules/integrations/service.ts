import "server-only"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import type {
  IntegrationDto,
  IntegrationTestResult,
  SaveIntegrationInput,
  SecretState,
} from "@/lib/schemas/api/integrations"
import {
  INTEGRATION_KEYS,
  INTEGRATIONS,
  type IntegrationConfig,
  type IntegrationKey,
  isSecretField,
} from "@/lib/schemas/integrations"
import { type DbOrTx, getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import { decryptSecret, encryptSecret, secretHint } from "@/server/lib/crypto"
import {
  AppError,
  conflict,
  fieldErrorsFromIssues,
  forbidden,
  notFound,
} from "@/server/lib/errors"
import { resolveSmtpTarget, type SmtpTarget } from "@/server/lib/smtp-target"
import { countMediaByDriver } from "@/server/modules/media/repo"

import {
  deleteIntegrationIfVersion,
  findIntegrationRow,
  insertIntegrationRow,
  type IntegrationRow,
  listIntegrationRows,
  updateIntegrationIfVersion,
} from "./repo"
import { runIntegrationTest, type TestResult } from "./testers"

type Values = Record<string, unknown>

const sameValue = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** AAD binding each ciphertext to its settings key and field (spec §4). */
export const secretAad = (key: IntegrationKey, field: string) =>
  `${key}.${field}`

function assertCan(actor: Actor, req: PermissionRequest) {
  if (!hasPermission(actor.roles, req)) throw forbidden()
}

const storedObject = (row: IntegrationRow | null): Values =>
  row && row.draft && typeof row.draft === "object" ? (row.draft as Values) : {}

/**
 * Plaintext values of a stored row. A secret that no longer decrypts (app
 * secret changed, ciphertext moved) becomes "" and is listed in `unreadable`.
 */
function openRow(
  key: IntegrationKey,
  row: IntegrationRow
): { values: Values; unreadable: string[] } {
  const stored = storedObject(row)
  const values: Values = {}
  const unreadable: string[] = []
  for (const field of INTEGRATIONS[key].fields) {
    const raw = stored[field]
    if (!isSecretField(key, field)) {
      values[field] = raw
      continue
    }
    if (typeof raw !== "string" || raw === "") {
      values[field] = ""
      continue
    }
    try {
      values[field] = decryptSecret(raw, secretAad(key, field))
    } catch {
      values[field] = ""
      unreadable.push(field)
    }
  }
  return { values, unreadable }
}

/**
 * Stored form: non-empty secrets encrypted with AAD "<key>.<field>". A secret
 * whose plaintext is unchanged keeps its stored ciphertext (no re-encryption).
 */
function sealValues(
  key: IntegrationKey,
  plain: Values,
  previous: { stored: Values; values: Values } | null
): Values {
  const sealed: Values = {}
  for (const field of INTEGRATIONS[key].fields) {
    const value = plain[field]
    if (!isSecretField(key, field) || typeof value !== "string" || value === "")
      sealed[field] = value
    else if (
      previous &&
      previous.values[field] === value &&
      typeof previous.stored[field] === "string"
    )
      sealed[field] = previous.stored[field]
    else sealed[field] = encryptSecret(value, secretAad(key, field))
  }
  return sealed
}

function toDto(
  key: IntegrationKey,
  row: IntegrationRow | null
): IntegrationDto {
  const def = INTEGRATIONS[key]
  const opened = row ? openRow(key, row) : null
  const stored = storedObject(row)
  const values: Values = {}
  const secrets: Record<string, SecretState> = {}
  for (const field of def.fields) {
    if (isSecretField(key, field)) {
      const raw = stored[field]
      const set = typeof raw === "string" && raw !== ""
      const plain = opened?.values[field]
      secrets[field] = {
        set,
        hint:
          set && typeof plain === "string" && plain !== ""
            ? secretHint(plain)
            : null,
      }
    } else {
      values[field] = opened
        ? opened.values[field]
        : (def.defaults as Values)[field]
    }
  }
  return {
    key,
    slug: def.slug,
    label: def.label,
    description: def.description,
    configured: row !== null,
    version: row?.version ?? 0,
    values,
    secrets,
    updatedAt: row ? row.updatedAt.toISOString() : null,
    updatedBy:
      row?.updatedBy && row.updatedByName
        ? { id: row.updatedBy, name: row.updatedByName }
        : null,
  }
}

/** Input over stored values: absent fields keep theirs, empty secrets keep the stored secret. */
function mergeValues(
  key: IntegrationKey,
  input: Values,
  previous: Values | null
): Values {
  const def = INTEGRATIONS[key]
  const merged: Values = {}
  for (const field of def.fields) {
    const value = input[field]
    if (isSecretField(key, field))
      merged[field] =
        typeof value === "string" && value.trim() !== ""
          ? value
          : (previous?.[field] ?? "")
    else
      merged[field] =
        field in input
          ? value
          : previous
            ? previous[field]
            : (def.defaults as Values)[field]
  }
  return merged
}

/**
 * Names of the fields whose value changed (audit diff: never values). A
 * secret that could no longer be decrypted counts as changed whether it was
 * dropped or entered again.
 */
function changedFields(
  key: IntegrationKey,
  previous: Values | null,
  next: Values,
  unreadable: readonly string[] = []
): string[] {
  return INTEGRATIONS[key].fields.filter(
    (field) =>
      unreadable.includes(field) || !sameValue(previous?.[field], next[field])
  )
}

/**
 * Fields that decide where a kept secret is sent. Changing one of them while
 * leaving the secret empty ("keep the stored one") would let whoever edits
 * the form send the stored secret to a server of their choice, so the
 * secret must be entered again.
 */
const RETARGET_RULES: Partial<
  Record<
    IntegrationKey,
    { targets: readonly string[]; secrets: Readonly<Record<string, string>> }
  >
> = {
  "integrations.smtp": {
    targets: ["host", "port", "secure", "user"],
    secrets: { password: "Enter the password again for the new server" },
  },
  "integrations.r2": {
    targets: ["accountId", "jurisdiction"],
    secrets: {
      accessKeyId: "Enter the access key ID again for the new account",
      secretAccessKey: "Enter the secret access key again for the new account",
    },
  },
  "integrations.ai": {
    targets: ["provider"],
    secrets: { apiKey: "Enter the API key again for the new provider" },
  },
}

function retargetErrors(
  key: IntegrationKey,
  input: Values,
  previous: Values | null,
  candidate: Values
): Record<string, string[]> {
  const rule = RETARGET_RULES[key]
  if (!rule || !previous) return {}
  if (
    rule.targets.every((field) => sameValue(candidate[field], previous[field]))
  )
    return {}
  const errors: Record<string, string[]> = {}
  for (const [field, message] of Object.entries(rule.secrets)) {
    const entered = input[field]
    const kept = !(typeof entered === "string" && entered.trim() !== "")
    // Only a secret that would be stored again (not one being cleared).
    if (kept && previous[field] !== "" && candidate[field] !== "")
      errors[field] = [message]
  }
  return errors
}

const BLOCKED_HOST_MESSAGE =
  "This address is not allowed for an email server (local or metadata address)"

export async function listIntegrations(
  actor: Actor
): Promise<{ items: IntegrationDto[] }> {
  assertCan(actor, { integration: ["read"] })
  const rows = await listIntegrationRows(getDb(), INTEGRATION_KEYS)
  const byKey = new Map(rows.map((row) => [row.key, row]))
  return {
    items: INTEGRATION_KEYS.map((key) => toDto(key, byKey.get(key) ?? null)),
  }
}

export async function getIntegration(
  actor: Actor,
  key: IntegrationKey
): Promise<IntegrationDto> {
  assertCan(actor, { integration: ["read"] })
  return toDto(key, await findIntegrationRow(getDb(), key))
}

/**
 * Saves immediately (integrations are not draft-versioned, spec §5.4).
 * Version first (409 with the current state), then validation (422).
 */
export async function saveIntegration(
  actor: Actor,
  key: IntegrationKey,
  input: SaveIntegrationInput
): Promise<IntegrationDto> {
  assertCan(actor, { integration: ["update"] })
  return getDb().transaction(async (tx) => {
    const row = await findIntegrationRow(tx, key)
    if ((row?.version ?? 0) !== input.version) throw conflict(toDto(key, row))
    const opened = row ? openRow(key, row) : null
    const previous = opened?.values ?? null
    const merged = mergeValues(key, input.values, previous)
    // SMTP without sign-in sends no password: none is kept.
    if (key === "integrations.smtp" && String(merged.user ?? "").trim() === "")
      merged.password = ""
    const parsed = INTEGRATIONS[key].schema.safeParse(merged)
    const fieldErrors = {
      ...(parsed.success ? {} : fieldErrorsFromIssues(parsed.error.issues)),
      ...retargetErrors(
        key,
        input.values,
        previous,
        parsed.success ? (parsed.data as Values) : merged
      ),
    }
    if (
      parsed.success &&
      key === "integrations.smtp" &&
      (await resolveSmtpTarget(String((parsed.data as Values).host))).kind ===
        "blocked"
    )
      fieldErrors.host = [BLOCKED_HOST_MESSAGE]
    if (!parsed.success || Object.keys(fieldErrors).length > 0)
      throw new AppError("VALIDATION_FAILED", "Check the highlighted fields", {
        fieldErrors,
      })
    const next = parsed.data as Values
    const stored = sealValues(
      key,
      next,
      row && previous ? { stored: storedObject(row), values: previous } : null
    )
    const saved = row
      ? await updateIntegrationIfVersion(tx, key, input.version, {
          draft: stored,
          updatedBy: actor.userId,
        })
      : await insertIntegrationRow(tx, {
          key,
          draft: stored,
          updatedBy: actor.userId,
        })
    if (!saved) throw conflict(toDto(key, await findIntegrationRow(tx, key)))
    await writeAudit(tx, actor, {
      action: row ? "integration.updated" : "integration.created",
      entityType: "integration",
      entityId: key,
      diff: {
        changed: changedFields(key, previous, next, opened?.unreadable ?? []),
      },
    })
    return toDto(key, await findIntegrationRow(tx, key))
  })
}

/** "Disconnect": removes the row. R2 stays while it stores files (their URLs would break). */
export async function deleteIntegration(
  actor: Actor,
  key: IntegrationKey,
  version: number
): Promise<{ ok: true }> {
  assertCan(actor, { integration: ["update"] })
  await getDb().transaction(async (tx) => {
    const row = await findIntegrationRow(tx, key)
    if (!row) throw notFound("Integration settings")
    if (row.version !== version) throw conflict(toDto(key, row))
    // Best effort only: an upload committing concurrently can still write an
    // r2 row after this count. The upload/migration path (Phase 6 Task 4)
    // re-checks the active driver under lock before writing to R2.
    if (key === "integrations.r2") {
      const stored = await countMediaByDriver(tx, "r2")
      if (stored > 0)
        throw new AppError(
          "CONFLICT",
          `${stored} uploaded file${stored === 1 ? " is" : "s are"} stored in R2. Delete ${stored === 1 ? "it" : "them"} from the media library first, or keep R2 connected.`
        )
    }
    if (!(await deleteIntegrationIfVersion(tx, key, version)))
      throw conflict(toDto(key, await findIntegrationRow(tx, key)))
    await writeAudit(tx, actor, {
      action: "integration.deleted",
      entityType: "integration",
      entityId: key,
    })
  })
  return { ok: true }
}

async function loadConfig<K extends IntegrationKey>(
  db: DbOrTx,
  key: K
): Promise<{ config: IntegrationConfig<K>; unreadable: string[] } | null> {
  const row = await findIntegrationRow(db, key)
  if (!row) return null
  const { values, unreadable } = openRow(key, row)
  if (unreadable.length > 0)
    return { config: values as IntegrationConfig<K>, unreadable }
  const parsed = INTEGRATIONS[key].schema.safeParse(values)
  if (!parsed.success)
    throw new AppError("INTERNAL", `Stored ${key} settings are invalid`)
  return { config: parsed.data as IntegrationConfig<K>, unreadable }
}

/**
 * Decrypted settings for server code (mailer, storage, Turnstile, AI).
 * null = not configured. Never send the result to a client or a log.
 */
export async function readIntegrationConfig<K extends IntegrationKey>(
  key: K,
  db: DbOrTx = getDb()
): Promise<IntegrationConfig<K> | null> {
  const loaded = await loadConfig(db, key)
  if (!loaded) return null
  if (loaded.unreadable.length > 0)
    throw new AppError(
      "INTERNAL",
      `${INTEGRATIONS[key].label}: saved secrets cannot be decrypted (was BETTER_AUTH_SECRET changed?)`
    )
  return loaded.config
}

/** "Test connection" with the saved settings. A failed test is a result (200), not an error. */
export async function testIntegration(
  actor: Actor,
  key: IntegrationKey
): Promise<IntegrationTestResult> {
  assertCan(actor, { integration: ["test"] })
  const db = getDb()
  const loaded = await loadConfig(db, key)
  if (!loaded)
    throw new AppError(
      "VALIDATION_FAILED",
      "Save these settings before testing them."
    )
  if (loaded.unreadable.length > 0)
    throw new AppError(
      "VALIDATION_FAILED",
      "Some saved secrets can no longer be read. Enter them again and save.",
      {
        fieldErrors: Object.fromEntries(
          loaded.unreadable.map((field) => [
            field,
            ["Enter this again and save"],
          ])
        ),
      }
    )
  let result: TestResult
  if (key === "integrations.smtp") {
    const config = loaded.config as IntegrationConfig<"integrations.smtp">
    const target: SmtpTarget = await resolveSmtpTarget(config.host)
    if (target.kind === "blocked")
      throw new AppError("VALIDATION_FAILED", "Check the highlighted fields", {
        fieldErrors: { host: [BLOCKED_HOST_MESSAGE] },
      })
    result =
      target.kind === "unresolved"
        ? {
            ok: false,
            message: `Could not connect to the server (${config.host}:${config.port}).`,
          }
        : await runIntegrationTest(key, loaded.config, {
            smtpAddress: target.address,
          })
  } else result = await runIntegrationTest(key, loaded.config)
  await writeAudit(db, actor, {
    action: "integration.tested",
    entityType: "integration",
    entityId: key,
    diff: { ok: result.ok },
  })
  return { ...result, testedAt: new Date().toISOString() }
}
