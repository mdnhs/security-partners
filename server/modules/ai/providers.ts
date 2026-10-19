import "server-only"

import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { APICallError, type LanguageModel, RetryError } from "ai"

import type { AiConfig } from "@/lib/schemas/integrations"

/**
 * The chat model for the saved settings. Always a provider instance: a bare
 * model string would be routed through the Vercel AI Gateway (notes §6.3).
 */
export function createLanguageModel(
  config: Pick<AiConfig, "provider" | "model" | "apiKey" | "baseUrl">
): LanguageModel {
  switch (config.provider) {
    case "anthropic":
      return createAnthropic({ apiKey: config.apiKey })(config.model)
    case "openai":
      return createOpenAI({ apiKey: config.apiKey })(config.model)
    case "google":
      return createGoogleGenerativeAI({ apiKey: config.apiKey })(config.model)
    case "openai-compatible":
      // The base URL passed the SSRF check when it was saved (lib/ai/base-url).
      return createOpenAICompatible({
        baseURL: config.baseUrl,
        apiKey: config.apiKey,
        name: "custom",
      })(config.model)
    default: {
      const unknown: never = config.provider
      throw new Error(`Unknown AI provider ${String(unknown)}`)
    }
  }
}

const SETTINGS_PATH = "Settings › Integrations › AI assistant"

const causeOf = (error: unknown) =>
  RetryError.isInstance(error) ? error.lastError : error

/** What the panel shows for a failed answer — never the provider's own text (it may echo input). */
export function aiErrorMessage(error: unknown): string {
  const cause = causeOf(error)
  if (APICallError.isInstance(cause)) {
    const status = cause.statusCode
    if (status === 401 || status === 403)
      return `The AI provider rejected the API key. An owner or admin can check it in ${SETTINGS_PATH}.`
    if (status === 404)
      return `The AI provider does not offer the configured model. An owner or admin can change it in ${SETTINGS_PATH}.`
    if (status === 429)
      return "The AI provider is busy or its usage limit was reached. Try again in a minute."
    if (status !== undefined && status >= 500)
      return "The AI provider is having problems. Try again in a minute."
  }
  return "The assistant could not answer. Try again."
}

/** One server log line per failed answer: error class and HTTP status, no keys, no content. */
export function logAiError(error: unknown): void {
  const cause = causeOf(error)
  const status = APICallError.isInstance(cause) ? cause.statusCode : undefined
  const name = cause instanceof Error ? cause.name : typeof cause
  console.error(`[ai] answer failed: ${name}${status ? ` ${status}` : ""}`)
}
