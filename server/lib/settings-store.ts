import "server-only"

export {
  isSettingsKey,
  SETTINGS_KEYS,
  type SettingsKey,
  type SettingsValue,
} from "@/lib/schemas/settings"

/** Encrypted integration settings (schemas and module in Phase 7). */
export const INTEGRATION_KEYS = [
  "integrations.smtp",
  "integrations.r2",
  "integrations.turnstile",
  "integrations.ai",
] as const
export type IntegrationKey = (typeof INTEGRATION_KEYS)[number]
