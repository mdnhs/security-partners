import "server-only"

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

import { hkdfKey } from "@/lib/crypto/hkdf"
import { getEnv } from "@/server/env"

export type KeyPurpose =
  "secrets" | "preview" | "lead-ip" | "cron" | "newsletter"

const VERSION = "v1"
const IV_BYTES = 12
const TAG_BYTES = 16
const MIN_SECRET_LENGTH = 32
const BASE64URL = /^[A-Za-z0-9_-]*$/

/** An explicit secret must meet the same minimum as BETTER_AUTH_SECRET in server/env.ts. */
function rootSecret(secret?: string): string {
  if (secret === undefined) return getEnv().BETTER_AUTH_SECRET
  if (secret.length < MIN_SECRET_LENGTH)
    throw new Error(`Secret must be at least ${MIN_SECRET_LENGTH} characters`)
  return secret
}

/** HKDF-SHA256(ikm = BETTER_AUTH_SECRET, salt = "sp/v1", info = purpose) → 32 bytes. */
export function deriveKey(purpose: KeyPurpose, secret?: string): Buffer {
  return hkdfKey(rootSecret(secret), purpose)
}

/** AES-256-GCM with a random 12-byte IV. Returns "v1:<iv>:<ciphertext>:<tag>" (base64url parts). */
export function encryptSecret(
  plain: string,
  aad: string,
  secret?: string
): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv("aes-256-gcm", deriveKey("secrets", secret), iv)
  cipher.setAAD(Buffer.from(aad, "utf8"))
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [
    VERSION,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(":")
}

/** Throws if the token is malformed, was encrypted with another secret, another AAD, or was tampered with. */
export function decryptSecret(
  token: string,
  aad: string,
  secret?: string
): string {
  const parts = token.split(":")
  if (
    parts.length !== 4 ||
    parts[0] !== VERSION ||
    !parts.slice(1).every((part) => BASE64URL.test(part))
  )
    throw new Error("Malformed encrypted secret")
  const iv = Buffer.from(parts[1], "base64url")
  const ciphertext = Buffer.from(parts[2], "base64url")
  const tag = Buffer.from(parts[3], "base64url")
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES)
    throw new Error("Malformed encrypted secret")
  // Outside the try: env/config errors must surface as-is, not as a decryption failure.
  const key = deriveKey("secrets", secret)
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv)
    decipher.setAAD(Buffer.from(aad, "utf8"))
    decipher.setAuthTag(tag)
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8")
  } catch {
    throw new Error(
      "Unable to decrypt secret (wrong key, wrong context or tampered data)"
    )
  }
}

/** Shortest secret that gets a hint: 4 shown characters must stay a small fraction. */
export const SECRET_HINT_MIN_LENGTH = 12

/** "••••" + last 4 characters; null (no hint) for secrets under 12 characters. */
export function secretHint(plain: string): string | null {
  return plain.length < SECRET_HINT_MIN_LENGTH ? null : `••••${plain.slice(-4)}`
}
