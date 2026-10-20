import { z } from "zod"

import { mediaRef, paragraphsText, slug, text } from "../common"

/** The draft/published payload of a service (slug and sortOrder are columns). */
export const serviceContent = z.object({
  title: text,
  description: text,
  icon: mediaRef,
  heroImage: mediaRef,
  image: mediaRef,
  imageAlt: text,
  detail: z.object({
    intro: text,
    heading: text,
    overview: paragraphsText,
    included: z.array(text).min(1),
    callout: text,
  }),
})

/** A service as edited: slug + payload. */
export const serviceSchema = serviceContent.extend({ slug })

export type ServiceContent = z.infer<typeof serviceContent>
export type ServiceInput = z.infer<typeof serviceSchema>
