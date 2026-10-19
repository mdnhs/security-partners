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
import { normaliseBaseUrl } from "@/lib/ai/base-url"
import {
  AI_SHARE_ENQUIRY_OFF,
  type AiShareEnquiryDetails,
  aiShareEnquiryDetails,
  aiShareEnquiryDetailsInput,
} from "@/lib/schemas/integrations/ai"
import { smtpConfig } from "@/lib/schemas/integrations/smtp"
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
import { consumeRateLimit } from "@/server/lib/rate-limit"
import { resetR2Client } from "@/server/lib/r2-client"
import { resolveSmtpTarget, type SmtpTarget } from "@/server/lib/smtp-target"
import { countMediaByDriver } from "@/server/modules/media/repo"

import {
  deleteIntegrationIfVersion,
  findIntegrationRow,
  insertIntegrationRow,
  type IntegrationRow,
  listIntegrationRows,
  lockIntegrationRow,
  updateIntegrationIfVersion,
} from "./repo"
import { runIntegrationTest, type TestResult } from "./testers"

type Values = Record<string, unknown>

/** JSON with object keys sorted: jsonb does not keep the key order. */
const canonical = (value: unknown): string =>
  JSON.stringify(value ?? null, (_, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0
          )
        )
      : v
  )

const sameValue = (a: unknown, b: unknown) => canonical(a) === canonical(b)

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
    // Every field that shapes where files are read from and written to.
    targets: ["accountId", "jurisdiction", "bucket"],
    secrets: {
      accessKeyId: "Enter the access key ID again for the new bucket",
      secretAccessKey: "Enter the secret access key again for the new bucket",
    },
  },
}

/**
 * Where the AI key is sent: the provider, plus the base URL of an
 * OpenAI-compatible one. Unlike the rules above, a new target drops the
 * stored key (MK parity): it is never sent anywhere it was not entered for.
 */
const aiTarget = (values: Values) => {
  const provider = String(values.provider ?? "")
  return provider === "openai-compatible"
    ? `${provider} ${normaliseBaseUrl(String(values.baseUrl ?? ""))}`
    : provider
}
const AI_KEY_AGAIN = "Enter the API key again for the new provider"
const ACKNOWLEDGE_FIRST = "Confirm the acknowledgement first"

const isEntered = (value: unknown) =>
  typeof value === "string" && value.trim() !== ""

/**
 * The stored enquiry-details switch after this save (ruling 5). Turning it
 * on needs owner:manage (403) and the acknowledgement (422), and stamps who
 * and when; turning it off (anyone who may save) clears the stamp; an
 * unchanged "on" keeps the owner's stamp.
 *
 * `retargeted` (a new provider or OpenAI-compatible base URL): the details
 * would go to a processor the owner never acknowledged, so the switch is
 * reset to off. A switch re-sent as it was (no `acknowledge`) is reset
 * silently; only an owner re-acknowledging in the same save keeps it on.
 */
function nextShareEnquiryDetails(
  actor: Actor,
  input: Values,
  previous: Values | null,
  retargeted: boolean
): AiShareEnquiryDetails {
  const stored = aiShareEnquiryDetails.safeParse(previous?.shareEnquiryDetails)
  const current =
    stored.success && !retargeted ? stored.data : AI_SHARE_ENQUIRY_OFF
  if (!("shareEnquiryDetails" in input)) return current
  const parsed = aiShareEnquiryDetailsInput.safeParse(input.shareEnquiryDetails)
  if (!parsed.success)
    throw new AppError("VALIDATION_FAILED", "Check the highlighted fields", {
      fieldErrors: { shareEnquiryDetails: ["Invalid value"] },
    })
  if (!parsed.data.enabled) return AI_SHARE_ENQUIRY_OFF
  if (current.enabled) return current
  if (retargeted && parsed.data.acknowledge !== true)
    return AI_SHARE_ENQUIRY_OFF
  if (
    actor.impersonatorId ||
    !hasPermission(actor.roles, { owner: ["manage"] })
  )
    throw forbidden()
  if (parsed.data.acknowledge !== true)
    throw new AppError("VALIDATION_FAILED", ACKNOWLEDGE_FIRST, {
      fieldErrors: { shareEnquiryDetails: [ACKNOWLEDGE_FIRST] },
    })
  return {
    enabled: true,
    acknowledgedBy: actor.userId,
    acknowledgedAt: new Date().toISOString(),
  }
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

/**
 * Stored r2 files live only in the current bucket (migrate-media deletes the
 * disk copies): pointing R2 at another account, jurisdiction or bucket would
 * break every stored file's URL, and backups would stop being pruned in the
 * old bucket. Same rule as Disconnect. The caller holds the settings row lock.
 */
async function assertR2NotRetargetedWithFiles(
  tx: DbOrTx,
  previous: Values,
  next: Values
): Promise<void> {
  const targets = RETARGET_RULES["integrations.r2"]?.targets ?? []
  if (targets.every((field) => sameValue(next[field], previous[field]))) return
  const stored = await countMediaByDriver(tx, "r2")
  if (stored === 0) return
  const one = stored === 1
  throw new AppError(
    "CONFLICT",
    `${stored} uploaded file${one ? " is" : "s are"} stored in the current R2 bucket. The account, location and bucket cannot change while ${one ? "it is" : "they are"} there: delete ${one ? "it" : "them"} from the media library first.`
  )
}

/** Host names compare case-insensitively, without surrounding space. */
const normalHost = (host: string) => host.trim().toLowerCase()

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
  // The SMTP host check may wait for DNS (up to its timeout): do it before
  // the transaction so no connection/transaction is held meanwhile.
  // Only a host that passes the schema's own checks (trimmed, server-name
  // characters) is looked up: invalid input never reaches DNS.
  const entered =
    key === "integrations.smtp"
      ? smtpConfig.shape.host.safeParse(input.values.host)
      : null
  const preResolved = entered?.success
    ? {
        host: normalHost(entered.data),
        target: await resolveSmtpTarget(entered.data),
      }
    : null
  return getDb().transaction(async (tx) => {
    // R2: row lock first, in the same order as Disconnect and uploads
    // (media `lockR2Settings` holds it FOR SHARE), so the file count below
    // cannot miss an upload in flight.
    if (key === "integrations.r2") await lockIntegrationRow(tx, key)
    const row = await findIntegrationRow(tx, key)
    if ((row?.version ?? 0) !== input.version) throw conflict(toDto(key, row))
    const opened = row ? openRow(key, row) : null
    const previous = opened?.values ?? null
    const merged = mergeValues(key, input.values, previous)
    // "Remove key": only this integration's secrets, never with a new value.
    const clearErrors: Record<string, string[]> = {}
    for (const field of input.clearSecrets ?? []) {
      if (!isSecretField(key, field))
        throw new AppError(
          "VALIDATION_FAILED",
          "Only a secret can be removed",
          {
            fieldErrors: { clearSecrets: ["Only a secret can be removed"] },
          }
        )
      if (isEntered(input.values[field]))
        clearErrors[field] = ["Either enter a new value or remove it, not both"]
      else merged[field] = ""
    }
    if (Object.keys(clearErrors).length > 0)
      throw new AppError("VALIDATION_FAILED", "Check the highlighted fields", {
        fieldErrors: clearErrors,
      })
    if (key === "integrations.r2" && previous) {
      // Before field validation: re-entering the keys cannot help here.
      const candidate = INTEGRATIONS[key].schema.safeParse(merged)
      await assertR2NotRetargetedWithFiles(
        tx,
        previous,
        candidate.success ? (candidate.data as Values) : merged
      )
    }
    // SMTP without sign-in sends no password: none is kept.
    if (key === "integrations.smtp" && String(merged.user ?? "").trim() === "")
      merged.password = ""
    let aiKeyDropped = false
    if (key === "integrations.ai") {
      // Only an OpenAI-compatible provider has a base URL.
      if (merged.provider !== "openai-compatible") merged.baseUrl = ""
      const retargeted =
        previous !== null && aiTarget(merged) !== aiTarget(previous)
      merged.shareEnquiryDetails = nextShareEnquiryDetails(
        actor,
        input.values,
        previous,
        retargeted
      )
      if (
        retargeted &&
        !isEntered(input.values.apiKey) &&
        merged.apiKey !== ""
      ) {
        merged.apiKey = ""
        aiKeyDropped = true
      }
    }
    const parsed = INTEGRATIONS[key].schema.safeParse(merged)
    const fieldErrors: Record<string, string[]> = {
      ...(parsed.success ? {} : fieldErrorsFromIssues(parsed.error.issues)),
      ...retargetErrors(
        key,
        input.values,
        previous,
        parsed.success ? (parsed.data as Values) : merged
      ),
    }
    if (parsed.success && key === "integrations.smtp") {
      const host = String((parsed.data as Values).host)
      const target =
        preResolved?.host === normalHost(host)
          ? preResolved.target
          : await resolveSmtpTarget(host)
      if (target.kind === "blocked") fieldErrors.host = [BLOCKED_HOST_MESSAGE]
    }
    // An assistant left on needs the key again for its new provider.
    if (aiKeyDropped && fieldErrors.apiKey) fieldErrors.apiKey = [AI_KEY_AGAIN]
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
    // Row lock first: an upload writing an r2 media row holds this row FOR
    // SHARE in its own transaction (media `lockR2Settings`), so the count
    // below sees its row, and an upload that starts later sees R2 gone.
    await lockIntegrationRow(tx, key)
    const row = await findIntegrationRow(tx, key)
    if (!row) throw notFound("Integration settings")
    if (row.version !== version) throw conflict(toDto(key, row))
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
  // The shared storage client must not outlive its settings (a save is
  // picked up by its changed fingerprint, server/lib/r2-client.ts).
  if (key === "integrations.r2") resetR2Client()
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

/**
 * Whether server code can use the saved settings: "unreadable" is the
 * AppError("INTERNAL") readIntegrationConfig throws for a saved row it
 * cannot use (a secret that no longer decrypts, or stored values that no
 * longer validate), so callers that fail open on it — the public leads
 * route skips Turnstile — can be surfaced on the dashboard. Anything else
 * (a database error) is rethrown: it says nothing about the settings.
 */
export async function integrationReadState(
  key: IntegrationKey,
  db: DbOrTx = getDb()
): Promise<"missing" | "ok" | "unreadable"> {
  try {
    return (await readIntegrationConfig(key, db)) ? "ok" : "missing"
  } catch (err) {
    if (err instanceof AppError && err.code === "INTERNAL") return "unreadable"
    throw err
  }
}

/** "Test connection" with the saved settings. A failed test is a result (200), not an error. */
/** Spec §6.3: "Test connection" at most 5 a minute per user. */
export const INTEGRATION_TEST_RATE_LIMIT = { max: 5, windowMs: 60_000 } as const

export async function testIntegration(
  actor: Actor,
  key: IntegrationKey
): Promise<IntegrationTestResult> {
  assertCan(actor, { integration: ["test"] })
  // Each test reaches an outside service with the saved secrets.
  const limit = await consumeRateLimit(
    `integrations:test:${actor.userId}`,
    INTEGRATION_TEST_RATE_LIMIT
  )
  if (!limit.allowed)
    throw new AppError(
      "RATE_LIMITED",
      "You have run a lot of connection tests. Wait a minute, then try again."
    )
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
