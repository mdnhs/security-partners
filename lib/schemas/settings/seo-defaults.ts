import { z } from "zod"

import { httpUrl, mediaRef, text } from "../common"

/** schema.org types the business presents as (schema.org has no "SecurityService"). */
export const ORGANIZATION_TYPES = [
  "LocalBusiness",
  "ProfessionalService",
] as const

/** Business facts for the site-wide JSON-LD (spec §10). */
export const organizationSettings = z.object({
  type: z.enum(ORGANIZATION_TYPES),
  streetAddress: text,
  addressLocality: text,
  addressRegion: text,
  postalCode: text,
  addressCountry: z
    .string()
    .regex(/^[A-Z]{2}$/, "Two capital letters, e.g. IE"),
  areaServed: text,
  /** Official profiles (LinkedIn, Facebook …). */
  sameAs: z.array(httpUrl).max(10),
})
export type OrganizationSettings = z.infer<typeof organizationSettings>

/** settings.seo.defaults — site title, "{title} | …" template, default description, share image, business facts. */
export const seoDefaultsSettings = z.object({
  title: text,
  titleTemplate: text,
  description: text,
  ogImage: mediaRef.nullable(),
  organization: organizationSettings,
})
export type SeoDefaultsSettings = z.infer<typeof seoDefaultsSettings>
