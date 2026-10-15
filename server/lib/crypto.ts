import "server-only"

import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto"

import { getEnv } from "@/server/env"

export type KeyPurpose = "secrets" | "preview" | "lead-ip" | "cron"

const SALT = "sp/v1"
const VERSION = "v1"
const IV_BYTES = 12
const TAG_BYTES = 16

const rootSecret = (secret?: string) => secret ?? getEnv().BETTER_AUTH_SECRET

/** HKDF-SHA256(ikm = BETTER_AUTH_SECRET, salt = "sp/v1", info = purpose) → 32 bytes. */
export function deriveKey(purpose: KeyPurpose, secret?: string): Buffer {
  return Buffer.from(hkdfSync("sha256", rootSecret(secret), SALT, purpose, 32))
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
  if (parts.length !== 4 || parts[0] !== VERSION)
    throw new Error("Malformed encrypted secret")
  const iv = Buffer.from(parts[1], "base64url")
  const ciphertext = Buffer.from(parts[2], "base64url")
  const tag = Buffer.from(parts[3], "base64url")
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES)
    throw new Error("Malformed encrypted secret")
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveKey("secrets", secret),
      iv
    )
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

/** "••••" + last 4 characters. Secrets of 4 characters or fewer reveal nothing. */
export function secretHint(plain: string): string {
  return plain.length <= 4 ? "••••" : `••••${plain.slice(-4)}`
}
