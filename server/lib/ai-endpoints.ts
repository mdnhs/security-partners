import "server-only"

import { normaliseBaseUrl } from "@/lib/ai/base-url"
import type { AiProvider } from "@/lib/schemas/integrations"
import { guardedFetch } from "@/server/lib/ai-target"

/**
 * Provider endpoints shared by "List models" (modules/ai) and "Test
 * connection" (modules/integrations).
 */

const GOOGLE_API = "https://generativelanguage.googleapis.com/v1beta"

/** How each provider takes the API key (sent only to the saved target). */
export function aiAuthHeaders(
  provider: AiProvider,
  apiKey: string
): Record<string, string> {
  switch (provider) {
    case "anthropic":
      return { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
    case "google":
      return { "x-goog-api-key": apiKey }
    case "openai":
    case "openai-compatible":
      return { authorization: `Bearer ${apiKey}` }
    default: {
      const unknown: never = provider
      throw new Error(`Unknown AI provider ${String(unknown)}`)
    }
  }
}

/** The provider's model-list endpoint (a compatible base URL is checked by the caller). */
export function aiModelsUrl(provider: AiProvider, baseUrl: string): string {
  switch (provider) {
    case "anthropic":
      return "https://api.anthropic.com/v1/models"
    case "openai":
      return "https://api.openai.com/v1/models"
    case "google":
      return `${GOOGLE_API}/models`
    case "openai-compatible":
      return `${normaliseBaseUrl(baseUrl)}/models`
    default: {
      const unknown: never = provider
      throw new Error(`Unknown AI provider ${String(unknown)}`)
    }
  }
}

/**
 * The fetch for a provider's endpoints: a user-set base URL goes through
 * the SSRF guard (server/lib/ai-target); the fixed public APIs use fetch.
 */
export const aiFetchFor = (provider: AiProvider): typeof fetch =>
  provider === "openai-compatible" ? guardedFetch : fetch
