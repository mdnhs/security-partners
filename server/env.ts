import "server-only"

import { z } from "zod"

const NODE_ENVS = ["development", "production", "test"] as const

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

const isPostgresUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === "postgres:" || url.protocol === "postgresql:"
  } catch {
    return false
  }
}

const envSchema = z.object({
  DATABASE_URL: z
    .string({ error: "is required" })
    .min(1, "is required")
    .refine(isPostgresUrl, "must be a postgres:// or postgresql:// URL"),
  BETTER_AUTH_SECRET: z
    .string({ error: "is required" })
    .min(1, "is required")
    .min(32, "must be at least 32 characters"),
  BETTER_AUTH_URL: z
    .string({ error: "is required" })
    .min(1, "is required")
    .refine(isHttpUrl, "must be an absolute http(s) URL"),
  NODE_ENV: z.enum(NODE_ENVS).default("development"),
})

export type Env = z.infer<typeof envSchema>

const KEYS = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "NODE_ENV",
] as const

/** Validates an env source. Throws one readable error listing every bad var (values are never echoed). */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const input: Record<string, string | undefined> = {}
  for (const key of KEYS) {
    const value = source[key]
    input[key] = value === "" ? undefined : value
  }
  const result = envSchema.safeParse(input)
  if (result.success) return result.data
  const firstIssue = new Map<string, string>()
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "env")
    if (!firstIssue.has(key)) firstIssue.set(key, issue.message)
  }
  const lines = [...firstIssue].map(
    ([key, message]) => `  - ${key}: ${message}`
  )
  throw new Error(
    [
      "Invalid environment configuration:",
      ...lines,
      "Set these variables before starting the server (see .env.example).",
    ].join("\n")
  )
}

let cache: { signature: string; env: Env } | undefined

/** Lazy, memoised. Never call at module scope: `next build` runs without env vars. */
export function getEnv(): Env {
  const signature = KEYS.map((key) => process.env[key] ?? "").join("\u0000")
  if (cache?.signature === signature) return cache.env
  const env = parseEnv(process.env)
  cache = { signature, env }
  return env
}
