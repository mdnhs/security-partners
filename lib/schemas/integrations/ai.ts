import { z } from "zod"

import {
  AI_BASE_URL_MAX,
  baseUrlProblem,
  normaliseBaseUrl,
} from "@/lib/ai/base-url"
import { hasPermission } from "@/lib/auth/permissions"
import { ROLES, type Role } from "@/lib/auth/roles"

export const AI_FIELDS = [
  "enabled",
  "provider",
  "model",
  "apiKey",
  "baseUrl",
  "allowedRoles",
  "extraInstructions",
  "maxOutputTokens",
  "shareEnquiryDetails",
] as const
export const AI_SECRETS = ["apiKey"] as const
export const AI_PROVIDERS = [
  "anthropic",
  "openai",
  "google",
  "openai-compatible",
] as const
export type AiProvider = (typeof AI_PROVIDERS)[number]
/** Current Claude models; the first is the default (latest Claude, user instruction). */
export const AI_CLAUDE_MODELS = [
  "claude-sonnet-5-5",
  "claude-opus-5-5",
  "claude-haiku-5-5",
] as const
export const AI_DEFAULT_MODEL = AI_CLAUDE_MODELS[0]

export const AI_EXTRA_INSTRUCTIONS_MAX = 2000
export const AI_OUTPUT_TOKEN_LIMITS = {
  min: 64,
  max: 8192,
  default: 1024,
} as const

/** Roles that may be allowed the assistant: those holding ai:use (spec §6.1). */
export const AI_ROLES: readonly Role[] = ROLES.filter((role) =>
  hasPermission([role], { ai: ["use"] })
)

/**
 * Whether the assistant may read enquiry details (stored form). Only an
 * owner can turn it on, with an acknowledgement (ruling 5); the server
 * stamps who and when.
 */
export const aiShareEnquiryDetails = z.object({
  enabled: z.boolean(),
  acknowledgedBy: z.string().nullable(),
  acknowledgedAt: z.iso.datetime().nullable(),
})
export type AiShareEnquiryDetails = z.output<typeof aiShareEnquiryDetails>
export const AI_SHARE_ENQUIRY_OFF: AiShareEnquiryDetails = {
  enabled: false,
  acknowledgedBy: null,
  acknowledgedAt: null,
}

/** What the settings form sends for the enquiry-details switch (PUT input). */
export const aiShareEnquiryDetailsInput = z.strictObject({
  enabled: z.boolean({ error: "Required" }),
  acknowledge: z.boolean().optional(),
})
export type AiShareEnquiryDetailsInput = z.output<
  typeof aiShareEnquiryDetailsInput
>

/** http://localhost model servers are for development only. */
export const allowLocalAiHttp = () => process.env.NODE_ENV !== "production"

/** Settings ▸ AI assistant (spec §5.4, §6.3, §8.3). */
export const aiConfig = z
  .object({
    enabled: z.boolean({ error: "Required" }),
    provider: z.enum(AI_PROVIDERS, { error: "Choose a provider" }),
    model: z
      .string({ error: "Required" })
      .trim()
      .max(100)
      .regex(/^[A-Za-z0-9._:/-]*$/, "Use the model ID from the provider"),
    apiKey: z.string().trim().max(500),
    /** OpenAI-compatible only (the save clears it for the other providers). */
    baseUrl: z
      .string()
      .max(AI_BASE_URL_MAX)
      .transform(normaliseBaseUrl)
      .default(""),
    allowedRoles: z
      .array(z.enum(ROLES))
      .max(ROLES.length)
      .refine((roles) => new Set(roles).size === roles.length, {
        message: "Each role once",
      }),
    extraInstructions: z
      .string()
      .trim()
      .max(
        AI_EXTRA_INSTRUCTIONS_MAX,
        `At most ${AI_EXTRA_INSTRUCTIONS_MAX} characters`
      )
      .default(""),
    maxOutputTokens: z
      .number({ error: "Enter a number" })
      .int("Enter a whole number")
      .min(
        AI_OUTPUT_TOKEN_LIMITS.min,
        `Between ${AI_OUTPUT_TOKEN_LIMITS.min} and ${AI_OUTPUT_TOKEN_LIMITS.max}`
      )
      .max(
        AI_OUTPUT_TOKEN_LIMITS.max,
        `Between ${AI_OUTPUT_TOKEN_LIMITS.min} and ${AI_OUTPUT_TOKEN_LIMITS.max}`
      )
      .default(AI_OUTPUT_TOKEN_LIMITS.default),
    shareEnquiryDetails: aiShareEnquiryDetails.default(AI_SHARE_ENQUIRY_OFF),
  })
  .superRefine((value, ctx) => {
    value.allowedRoles.forEach((role, index) => {
      if (!AI_ROLES.includes(role))
        ctx.addIssue({
          code: "custom",
          path: ["allowedRoles", index],
          message: `The ${role} role cannot use the assistant`,
        })
    })
    if (value.provider === "openai-compatible") {
      const problem = baseUrlProblem(value.baseUrl, {
        allowLocalHttp: allowLocalAiHttp(),
      })
      if (problem)
        ctx.addIssue({ code: "custom", path: ["baseUrl"], message: problem })
    }
    if (!value.enabled) return
    if (value.model === "")
      ctx.addIssue({
        code: "custom",
        path: ["model"],
        message: "Required while the assistant is on",
      })
    if (value.apiKey === "")
      ctx.addIssue({
        code: "custom",
        path: ["apiKey"],
        message: "Required while the assistant is on",
      })
  })
export type AiConfig = z.output<typeof aiConfig>

export const AI_DEFAULTS = {
  enabled: false,
  provider: "anthropic",
  model: AI_DEFAULT_MODEL,
  baseUrl: "",
  allowedRoles: [...AI_ROLES],
  extraInstructions: "",
  maxOutputTokens: AI_OUTPUT_TOKEN_LIMITS.default,
  shareEnquiryDetails: AI_SHARE_ENQUIRY_OFF,
} as const
