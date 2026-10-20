import { z } from "zod"

export const TURNSTILE_FIELDS = ["enabled", "siteKey", "secretKey"] as const
export const TURNSTILE_SECRETS = ["secretKey"] as const

/** Settings ▸ Integrations ▸ Spam protection (spec §5.4, §9). */
export const turnstileConfig = z
  .object({
    enabled: z.boolean({ error: "Required" }),
    siteKey: z
      .string({ error: "Required" })
      .trim()
      .max(100)
      .regex(/^[0-9A-Za-z_-]*$/, "Letters, digits, - and _ only"),
    secretKey: z.string().trim().max(200),
  })
  .superRefine((value, ctx) => {
    if (!value.enabled) return
    for (const field of ["siteKey", "secretKey"] as const)
      if (value[field] === "")
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Required while spam protection is on",
        })
  })
export type TurnstileConfig = z.output<typeof turnstileConfig>

export const TURNSTILE_DEFAULTS = { enabled: false, siteKey: "" } as const
