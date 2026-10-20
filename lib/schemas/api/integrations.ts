import { z } from "zod"

import {
  INTEGRATION_KEYS,
  type IntegrationKey,
  type IntegrationSlug,
} from "@/lib/schemas/integrations"

export const integrationKeyParam = z.object({ key: z.enum(INTEGRATION_KEYS) })

/**
 * PUT /integrations/:key. `version` 0 = first save. `values` is validated by
 * the service after merging with the stored config (absent fields keep
 * their value; an empty secret keeps the stored secret).
 */
export const saveIntegrationInput = z.object({
  version: z.number().int().min(0),
  values: z.record(z.string(), z.unknown()),
  /**
   * Secret fields to delete ("Remove key"). An empty secret in `values`
   * keeps the stored one, so clearing must be asked for explicitly.
   */
  clearSecrets: z.array(z.string().max(64)).max(10).optional(),
})
export type SaveIntegrationInput = z.output<typeof saveIntegrationInput>

/** DELETE /integrations/:key?version= */
export const integrationVersionQuery = z.object({
  version: z.coerce.number().int().min(1),
})

/** A write-only secret as the API shows it: hint "••••abcd" (null when unset, unreadable or under 12 characters). */
export type SecretState = { set: boolean; hint: string | null }

export type IntegrationDto = {
  key: IntegrationKey
  slug: IntegrationSlug
  label: string
  description: string
  configured: boolean
  /** 0 until the first save. */
  version: number
  /** Non-secret fields only. */
  values: Record<string, unknown>
  secrets: Record<string, SecretState>
  updatedAt: string | null
  updatedBy: { id: string; name: string } | null
}

export type IntegrationTestResult = {
  ok: boolean
  message: string
  testedAt: string
}
