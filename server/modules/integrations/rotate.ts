import "server-only"

import {
  INTEGRATION_KEYS,
  INTEGRATIONS,
  type IntegrationKey,
} from "@/lib/schemas/integrations"
import { type DbOrTx, getDb } from "@/server/db/client"
import { getEnv } from "@/server/env"
import { writeAudit } from "@/server/lib/audit"
import { decryptSecret, encryptSecret } from "@/server/lib/crypto"
import {
  clearAllTwoFactor,
  deleteAllSessions,
} from "@/server/modules/users/repo"

import {
  listIntegrationRows,
  lockIntegrationRow,
  replaceIntegrationDraft,
} from "./repo"
import { secretAad } from "./service"

export type ReencryptResult = {
  draft: Record<string, unknown>
  /** "<key>.<field>" re-encrypted with the new key. */
  fields: string[]
  /** "<key>.<field>" that already decrypt with the new key (a re-run). */
  alreadyCurrent: string[]
}

/** Re-encrypts the secret fields of one stored integration object. Throws if one is unreadable with both keys. */
export function reencryptDraft(
  key: IntegrationKey,
  draft: Record<string, unknown>,
  fromSecret: string,
  toSecret: string
): ReencryptResult {
  const next: Record<string, unknown> = { ...draft }
  const fields: string[] = []
  const alreadyCurrent: string[] = []
  for (const field of INTEGRATIONS[key].secrets) {
    const value = draft[field]
    if (typeof value !== "string" || value === "") continue
    const aad = secretAad(key, field)
    let plain: string
    try {
      plain = decryptSecret(value, aad, fromSecret)
    } catch {
      try {
        decryptSecret(value, aad, toSecret)
      } catch {
        throw new Error(
          `${key}.${field} cannot be decrypted with the old or the new secret`
        )
      }
      alreadyCurrent.push(`${key}.${field}`)
      continue
    }
    next[field] = encryptSecret(plain, aad, toSecret)
    fields.push(`${key}.${field}`)
  }
  return { draft: next, fields, alreadyCurrent }
}

export type RotateReport = {
  reencrypted: string[]
  alreadyCurrent: string[]
  twoFactorCleared: number
  sessionsRevoked: number
}

/**
 * Spec §4 rotation, in one transaction: integration secrets move from the
 * key derived from `fromSecret` to the key derived from `toSecret` (default:
 * the current BETTER_AUTH_SECRET); 2FA is cleared and every session ends.
 */
export async function rotateSecrets(opts: {
  fromSecret: string
  toSecret?: string
  via?: string
  db?: DbOrTx
}): Promise<RotateReport> {
  const toSecret = opts.toSecret ?? getEnv().BETTER_AUTH_SECRET
  const db = opts.db ?? getDb()
  return db.transaction(async (tx) => {
    const reencrypted: string[] = []
    const alreadyCurrent: string[] = []
    // FOR UPDATE until commit: a concurrent Settings save either finishes
    // first (and is re-encrypted here) or waits and then fails its version
    // check (409), so no write is lost and no stale ciphertext is stored.
    for (const key of INTEGRATION_KEYS) await lockIntegrationRow(tx, key)
    for (const row of await listIntegrationRows(tx, INTEGRATION_KEYS)) {
      if (!row.draft || typeof row.draft !== "object") continue
      const key = row.key as IntegrationKey
      const result = reencryptDraft(
        key,
        row.draft as Record<string, unknown>,
        opts.fromSecret,
        toSecret
      )
      alreadyCurrent.push(...result.alreadyCurrent)
      if (result.fields.length === 0) continue
      await replaceIntegrationDraft(tx, key, result.draft)
      reencrypted.push(...result.fields)
    }
    const twoFactorCleared = await clearAllTwoFactor(tx)
    const sessionsRevoked = await deleteAllSessions(tx)
    await writeAudit(tx, null, {
      action: "secrets.rotated",
      diff: {
        via: opts.via ?? "secrets:rotate",
        reencrypted,
        alreadyCurrent,
        twoFactorCleared,
        sessionsRevoked,
      },
    })
    return { reencrypted, alreadyCurrent, twoFactorCleared, sessionsRevoked }
  })
}
