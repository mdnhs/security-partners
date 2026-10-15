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
