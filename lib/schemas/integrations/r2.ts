import { z } from "zod"

export const R2_FIELDS = [
  "accountId",
  "jurisdiction",
  "bucket",
  "accessKeyId",
  "secretAccessKey",
  "keyPrefix",
] as const
export const R2_SECRETS = ["accessKeyId", "secretAccessKey"] as const
/** EU-jurisdiction buckets live behind <account>.eu.r2.cloudflarestorage.com. */
export const R2_JURISDICTIONS = ["default", "eu"] as const

/** Lowercase [a-z0-9-_] segments joined by single "/" (no leading/trailing slash, no dots). */
export const R2_KEY_PREFIX_PATTERN = /^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/
export const R2_KEY_PREFIX_MAX = 64

/**
 * Optional folder inside the bucket ("" = the bucket root, the behaviour of
 * settings saved before it existed). The driver writes `<folder>/<key>`;
 * media rows keep the bare key, so changing it does not move stored files.
 */
export const r2KeyPrefix = z
  .string()
  .trim()
  .max(R2_KEY_PREFIX_MAX, `At most ${R2_KEY_PREFIX_MAX} characters`)
  .refine(
    (value) => value === "" || R2_KEY_PREFIX_PATTERN.test(value),
    "Lowercase letters, digits, - or _, in folders separated by single /, with no / at the start or end"
  )
  .optional()

/**
 * Settings ▸ Integrations ▸ Media storage (spec §5.4, §11). Media is served
 * same-origin by /api/v1/media/file/<key>, so the bucket stays private and
 * needs no public URL (phase 6 correction).
 */
export const r2Config = z.object({
  accountId: z
    .string({ error: "Required" })
    .trim()
    .regex(
      /^[0-9a-f]{32}$/,
      "The 32-character account ID (Cloudflare dashboard › R2)"
    ),
  jurisdiction: z.enum(R2_JURISDICTIONS, {
    error: "Choose where the bucket is stored",
  }),
  bucket: z
    .string({ error: "Required" })
    .trim()
    .regex(
      /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/,
      "3–63 lowercase letters, digits or hyphens"
    ),
  accessKeyId: z
    .string({ error: "Required" })
    .trim()
    .min(1, "Required")
    .max(128),
  secretAccessKey: z
    .string({ error: "Required" })
    .trim()
    .min(1, "Required")
    .max(256),
  keyPrefix: r2KeyPrefix,
})
export type R2Config = z.output<typeof r2Config>

export const R2_DEFAULTS = {
  accountId: "",
  jurisdiction: "default",
  bucket: "",
  keyPrefix: "",
} as const
