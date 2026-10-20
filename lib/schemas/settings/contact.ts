import { z } from "zod"

import { href, text } from "../common"

/**
 * settings.contact — numbers and addresses edited once. tel: hrefs are
 * derived at render (lib/interpolate.ts telHref); mapsHref is stored.
 */
export const contactSettings = z.object({
  phone24h: text,
  office: text,
  operationsMobile: text,
  operationsExtension: text,
  email: z.email(),
  operationsEmail: z.email(),
  hours: text,
  addressLine1: text,
  addressLine2: text,
  mapsHref: href,
})
export type ContactSettings = z.infer<typeof contactSettings>
