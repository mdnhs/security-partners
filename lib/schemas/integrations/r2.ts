import { z } from "zod"

export const R2_FIELDS = [
  "accountId",
  "jurisdiction",
  "bucket",
  "accessKeyId",
  "secretAccessKey",
] as const
export const R2_SECRETS = ["accessKeyId", "secretAccessKey"] as const
/** EU-jurisdiction buckets live behind <account>.eu.r2.cloudflarestorage.com. */
export const R2_JURISDICTIONS = ["default", "eu"] as const

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
})
export type R2Config = z.output<typeof r2Config>

export const R2_DEFAULTS = {
  accountId: "",
  jurisdiction: "default",
  bucket: "",
} as const
