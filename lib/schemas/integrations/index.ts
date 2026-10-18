import type { z } from "zod"

import {
  AI_DEFAULTS,
  AI_FIELDS,
  AI_SECRETS,
  type AiConfig,
  aiConfig,
} from "./ai"
import {
  R2_DEFAULTS,
  R2_FIELDS,
  R2_SECRETS,
  type R2Config,
  r2Config,
} from "./r2"
import {
  SMTP_DEFAULTS,
  SMTP_FIELDS,
  SMTP_SECRETS,
  type SmtpConfig,
  smtpConfig,
} from "./smtp"
import {
  TURNSTILE_DEFAULTS,
  TURNSTILE_FIELDS,
  TURNSTILE_SECRETS,
  type TurnstileConfig,
  turnstileConfig,
} from "./turnstile"

export { AI_PROVIDERS, AI_ROLES, type AiProvider } from "./ai"
export { R2_JURISDICTIONS } from "./r2"
export type { AiConfig, R2Config, SmtpConfig, TurnstileConfig }

/** Encrypted integration settings rows (spec §5.4). */
export const INTEGRATION_KEYS = [
  "integrations.smtp",
  "integrations.r2",
  "integrations.turnstile",
  "integrations.ai",
] as const
export type IntegrationKey = (typeof INTEGRATION_KEYS)[number]

type IntegrationDefinition = {
  /** Admin URL segment: /admin/settings/integrations/<slug>. */
  slug: string
  label: string
  description: string
  schema: z.ZodType
  fields: readonly string[]
  /** Encrypted at rest, write-only through the API. */
  secrets: readonly string[]
  /** Starting values of a form that was never saved (non-secret fields). */
  defaults: Readonly<Record<string, unknown>>
}

export const INTEGRATIONS = {
  "integrations.smtp": {
    slug: "smtp",
    label: "Email (SMTP)",
    description:
      "Sends invitations, password resets and enquiry notifications.",
    schema: smtpConfig,
    fields: SMTP_FIELDS,
    secrets: SMTP_SECRETS,
    defaults: SMTP_DEFAULTS,
  },
  "integrations.r2": {
    slug: "r2",
    label: "Media storage (Cloudflare R2)",
    description:
      "Keeps uploaded images and documents. Until it is set up, uploads stay on the server disk.",
    schema: r2Config,
    fields: R2_FIELDS,
    secrets: R2_SECRETS,
    defaults: R2_DEFAULTS,
  },
  "integrations.turnstile": {
    slug: "turnstile",
    label: "Spam protection (Cloudflare Turnstile)",
    description: "An invisible check on the contact form.",
    schema: turnstileConfig,
    fields: TURNSTILE_FIELDS,
    secrets: TURNSTILE_SECRETS,
    defaults: TURNSTILE_DEFAULTS,
  },
  "integrations.ai": {
    slug: "ai",
    label: "AI assistant",
    description: "Writing help in the admin for the roles you choose.",
    schema: aiConfig,
    fields: AI_FIELDS,
    secrets: AI_SECRETS,
    defaults: AI_DEFAULTS,
  },
} as const satisfies Record<IntegrationKey, IntegrationDefinition>

export type IntegrationConfigs = {
  "integrations.smtp": SmtpConfig
  "integrations.r2": R2Config
  "integrations.turnstile": TurnstileConfig
  "integrations.ai": AiConfig
}
export type IntegrationConfig<K extends IntegrationKey> = IntegrationConfigs[K]
export type IntegrationSlug = (typeof INTEGRATIONS)[IntegrationKey]["slug"]

export function isIntegrationKey(value: string): value is IntegrationKey {
  return (INTEGRATION_KEYS as readonly string[]).includes(value)
}

export function integrationKeyFromSlug(slug: string): IntegrationKey | null {
  return INTEGRATION_KEYS.find((key) => INTEGRATIONS[key].slug === slug) ?? null
}

export function isSecretField(key: IntegrationKey, field: string): boolean {
  return (INTEGRATIONS[key].secrets as readonly string[]).includes(field)
}
