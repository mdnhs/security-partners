import { z } from "zod"

import { hasPermission } from "@/lib/auth/permissions"
import { ROLES, type Role } from "@/lib/auth/roles"

export const AI_FIELDS = [
  "enabled",
  "provider",
  "model",
  "apiKey",
  "allowedRoles",
] as const
export const AI_SECRETS = ["apiKey"] as const
export const AI_PROVIDERS = ["anthropic", "openai"] as const
export type AiProvider = (typeof AI_PROVIDERS)[number]
/** Current Claude models; the first is the default (latest Claude, user instruction). */
export const AI_CLAUDE_MODELS = [
  "claude-sonnet-5-5",
  "claude-opus-5-5",
  "claude-haiku-5-5",
] as const
export const AI_DEFAULT_MODEL = AI_CLAUDE_MODELS[0]

/** Roles that may be allowed the assistant: those holding ai:use (spec §6.1). */
export const AI_ROLES: readonly Role[] = ROLES.filter((role) =>
  hasPermission([role], { ai: ["use"] })
)

/** Settings ▸ Integrations ▸ AI assistant (spec §5.4, §8.3). */
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
    allowedRoles: z
      .array(z.enum(ROLES))
      .max(ROLES.length)
      .refine((roles) => new Set(roles).size === roles.length, {
        message: "Each role once",
      }),
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
  allowedRoles: [...AI_ROLES],
} as const
