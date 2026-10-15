import { z } from "zod"

import { aboutSectionSettings } from "./sections-about"
import { clientsSectionSettings } from "./sections-clients"
import { consentSettings } from "./consent"
import { contactSettings } from "./contact"
import { contactSectionSettings } from "./sections-contact"
import { customCodeSettings } from "./custom-code"
import { enquireBannerSettings } from "./sections-enquire-banner"
import { footerSettings } from "./footer"
import { leadsSettings } from "./leads"
import { microcopySettings } from "./microcopy"
import { navigationSettings } from "./navigation"
import { seoDefaultsSettings } from "./seo-defaults"
import { siteSettings } from "./site"
import { trackingSettings } from "./tracking"
import { whyChooseUsSettings } from "./sections-why-choose-us"

/** One Zod schema per content settings key (spec §5.4). Integrations live in lib/schemas/integrations (Phase 7). */
export const settingsSchemas = {
  site: siteSettings,
  contact: contactSettings,
  navigation: navigationSettings,
  footer: footerSettings,
  "sections.enquireBanner": enquireBannerSettings,
  "sections.clients": clientsSectionSettings,
  "sections.whyChooseUs": whyChooseUsSettings,
  "sections.about": aboutSectionSettings,
  "sections.contact": contactSectionSettings,
  "seo.defaults": seoDefaultsSettings,
  consent: consentSettings,
  tracking: trackingSettings,
  customCode: customCodeSettings,
  microcopy: microcopySettings,
  leads: leadsSettings,
} as const

export type SettingsKey = keyof typeof settingsSchemas
export const SETTINGS_KEYS = Object.keys(settingsSchemas) as SettingsKey[]
export type SettingsValue<K extends SettingsKey> = z.infer<
  (typeof settingsSchemas)[K]
>

/** Keys the public site reads on every page (header, footer, shared sections). */
export const PUBLIC_SETTINGS_KEYS = [
  "site",
  "contact",
  "navigation",
  "footer",
  "sections.enquireBanner",
  "sections.clients",
  "sections.whyChooseUs",
  "sections.about",
  "sections.contact",
  "seo.defaults",
  "microcopy",
] as const satisfies readonly SettingsKey[]
export type PublicSettingsKey = (typeof PUBLIC_SETTINGS_KEYS)[number]

export function isSettingsKey(value: string): value is SettingsKey {
  return Object.hasOwn(settingsSchemas, value)
}
