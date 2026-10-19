import { z } from "zod"

/** Where the public signup form renders. "off" (seeded) renders nothing (ruling 2). */
export const NEWSLETTER_PLACEMENTS = ["off", "blog", "article"] as const
export type NewsletterPlacement = (typeof NEWSLETTER_PLACEMENTS)[number]

const statePage = z.object({
  title: z.string().max(80),
  body: z.string().max(400),
})

/** Fields that must be filled before the form can go live. */
const REQUIRED_WHEN_LIVE = [
  ["title"],
  ["button"],
  ["success"],
  ["confirmationEmail", "subject"],
] as const

/** settings.newsletter (spec §7.4): placement, double opt-in, retention and all copy. */
export const newsletterSettings = z
  .object({
    placement: z.enum(NEWSLETTER_PLACEMENTS),
    doubleOptIn: z.boolean(),
    pendingDays: z.number().int().min(1).max(90),
    eyebrow: z.string().max(40),
    title: z.string().max(120),
    subtitle: z.string().max(240),
    emailLabel: z.string().max(40),
    placeholder: z.string().max(60),
    button: z.string().max(30),
    success: z.string().max(200),
    errors: z.object({
      email: z.string().max(80),
      rateLimited: z.string().max(160),
      generic: z.string().max(160),
    }),
    confirmationEmail: z.object({
      subject: z.string().max(120),
      body: z.string().max(2000),
    }),
    pages: z.object({
      /** The view the confirmation mail links to: its button POSTs the token. */
      confirm: statePage.extend({ button: z.string().max(40) }),
      confirmed: statePage,
      invalid: statePage,
      unsubscribe: statePage.extend({ button: z.string().max(40) }),
      unsubscribed: statePage,
    }),
  })
  .superRefine((value, ctx) => {
    if (value.placement === "off") return
    for (const path of REQUIRED_WHEN_LIVE) {
      const field = path.length === 1 ? value[path[0]] : value[path[0]][path[1]]
      if (field.trim() === "")
        ctx.addIssue({
          code: "custom",
          path: [...path],
          message: "Required while the signup form is shown",
        })
    }
  })
export type NewsletterSettings = z.infer<typeof newsletterSettings>

/** Copy the public form needs (never the email or state-page text). */
export type NewsletterPublicCopy = Pick<
  NewsletterSettings,
  | "eyebrow"
  | "title"
  | "subtitle"
  | "emailLabel"
  | "placeholder"
  | "button"
  | "success"
  | "errors"
>

export function toPublicCopy(s: NewsletterSettings): NewsletterPublicCopy {
  return {
    eyebrow: s.eyebrow,
    title: s.title,
    subtitle: s.subtitle,
    emailLabel: s.emailLabel,
    placeholder: s.placeholder,
    button: s.button,
    success: s.success,
    errors: { ...s.errors },
  }
}
