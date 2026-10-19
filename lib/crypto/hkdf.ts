import { hkdfSync } from "node:crypto"

/** HKDF salt shared by every derived key (server/lib/crypto deriveKey). */
export const HKDF_SALT = "sp/v1"

/**
 * HKDF-SHA256(ikm = secret, salt = "sp/v1", info = purpose) → 32 bytes.
 * Pure (no env, no server-only) so the e2e can derive the same keys from
 * its own secret; server code goes through deriveKey().
 */
export function hkdfKey(secret: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, HKDF_SALT, purpose, 32))
}
