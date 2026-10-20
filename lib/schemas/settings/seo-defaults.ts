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

/** Site-wide robots mode: noindex blocks the whole site (robots.txt + root meta). */
export const ROBOTS_MODES = ["index", "noindex"] as const
export type RobotsMode = (typeof ROBOTS_MODES)[number]

/**
 * A search-console verification token: the meta tag's content value only.
 * Strict charset, so nothing but the token can reach the <meta> tag.
 */
const verificationToken = z
  .string()
  .max(100)
  .regex(
    /^[A-Za-z0-9_-]*$/,
    'Paste only the code from the tag\'s content="…": letters, numbers, - and _'
  )

/** settings.seo.defaults — site title, "{title} | …" template, default description, share image, business facts, robots mode, verification tokens. */
export const seoDefaultsSettings = z.object({
  title: text,
  titleTemplate: text.refine((value) => value.includes("{title}"), {
    message: "Include {title} where the page name goes",
  }),
  description: text,
  ogImage: mediaRef.nullable(),
  organization: organizationSettings,
  robots: z.enum(ROBOTS_MODES),
  verification: z.object({
    google: verificationToken,
    bing: verificationToken,
  }),
})
export type SeoDefaultsSettings = z.infer<typeof seoDefaultsSettings>
