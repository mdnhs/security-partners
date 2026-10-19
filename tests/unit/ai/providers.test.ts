import { APICallError, RetryError } from "ai"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  aiErrorMessage,
  createLanguageModel,
  logAiError,
} from "@/server/modules/ai/providers"

const SECRET = "sk-ant-secret-1234"

const apiError = (statusCode: number) =>
  new APICallError({
    message: `provider said ${SECRET}`,
    url: "https://api.anthropic.com/v1/messages",
    requestBodyValues: {},
    statusCode,
    isRetryable: statusCode >= 500,
  })

afterEach(() => vi.restoreAllMocks())

describe("createLanguageModel (libraries notes §6.3)", () => {
  it("builds a provider instance for the saved provider, never a gateway string", () => {
    const claude = createLanguageModel({
      provider: "anthropic",
      model: "claude-sonnet-5-5",
      apiKey: SECRET,
      baseUrl: "",
    })
    expect(typeof claude).toBe("object")
    expect(claude).toMatchObject({
      provider: "anthropic.messages",
      modelId: "claude-sonnet-5-5",
      specificationVersion: "v4",
    })
    expect(
      createLanguageModel({
        provider: "openai",
        model: "gpt-5",
        apiKey: "sk-o",
        baseUrl: "",
      })
    ).toMatchObject({ provider: "openai.responses", modelId: "gpt-5" })
  })

  it("builds Gemini and OpenAI-compatible instances", () => {
    expect(
      createLanguageModel({
        provider: "google",
        model: "gemini-2.5-flash",
        apiKey: "g-key",
        baseUrl: "",
      })
    ).toMatchObject({
      provider: "google.generative-ai",
      modelId: "gemini-2.5-flash",
      specificationVersion: "v4",
    })
    expect(
      createLanguageModel({
        provider: "openai-compatible",
        model: "llama-3.3-70b",
        apiKey: "c-key",
        baseUrl: "https://api.groq.com/openai/v1",
      })
    ).toMatchObject({
      provider: "custom.chat",
      modelId: "llama-3.3-70b",
      specificationVersion: "v4",
    })
  })
})

describe("aiErrorMessage", () => {
  it("explains key, model, busy and outage failures without provider text", () => {
    expect(aiErrorMessage(apiError(401))).toMatch(/rejected the API key/)
    expect(aiErrorMessage(apiError(403))).toMatch(/rejected the API key/)
    expect(aiErrorMessage(apiError(404))).toMatch(/configured model/)
    expect(aiErrorMessage(apiError(429))).toMatch(/busy/)
    expect(aiErrorMessage(apiError(503))).toMatch(/having problems/)
    const retried = new RetryError({
      message: "Failed after 2 attempts",
      reason: "maxRetriesExceeded",
      errors: [apiError(500), apiError(529)],
    })
    expect(aiErrorMessage(retried)).toMatch(/having problems/)
    expect(aiErrorMessage(new Error(SECRET))).toBe(
      "The assistant could not answer. Try again."
    )
    for (const status of [401, 404, 429, 503])
      expect(aiErrorMessage(apiError(status))).not.toContain(SECRET)
  })

  it("logs the error class and status only", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    logAiError(apiError(401))
    logAiError(new Error(SECRET))
    expect(log.mock.calls.map((c) => c.join(" "))).toEqual([
      "[ai] answer failed: AI_APICallError 401",
      "[ai] answer failed: Error",
    ])
  })
})
