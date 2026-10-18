import { z } from "zod"

import { href, mediaRef, text } from "../common"

/** settings.sections.contact — Contact section, form copy and map shared by / and /contact (ruling). */
export const contactSectionSettings = z.object({
  eyebrow: text,
  heading: text,
  intro: text,
  infoItems: z
    .array(
      z.object({
        title: text,
        icon: mediaRef,
        lines: z.array(z.object({ text, href: href.optional() })).min(1),
      })
    )
    .min(1),
  form: z.object({
    nameLabel: text,
    namePlaceholder: text,
    emailLabel: text,
    emailPlaceholder: text,
    phoneLabel: text,
    phonePlaceholder: text,
    messageLabel: text,
    messagePlaceholder: text,
    submitLabel: text,
    /** Button text while the enquiry is being sent. */
    sendingLabel: text,
    successMessage: text,
    errorMessage: text,
    /** Shown on 429 (more than 5 enquiries in 10 minutes). */
    rateLimitedMessage: text,
    /** Subject of the staff notification email; {name} = the visitor. */
    mailtoSubject: text,
  }),
  map: z.object({
    link: href,
    ariaLabel: text,
    label: text,
    /** Tile URL template, {col} 0–8 and {row} 0–1. */
    tiles: text,
  }),
})
export type ContactSectionSettings = z.infer<typeof contactSectionSettings>
