import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import type { SettingsKey } from "@/lib/schemas/settings"

/**
 * Settings edited under Settings (master 4.5). consent/tracking (Marketing)
 * and customCode (owner) live in the Phase 8 module; seo.defaults in the
 * Phase 8 SEO screen; integrations.* in Phase 7.
 */
export const EDITABLE_SETTINGS_KEYS = [
  "site",
  "contact",
  "navigation",
  "footer",
  "microcopy",
  "sections.about",
  "sections.contact",
  "sections.enquireBanner",
  "sections.clients",
  "sections.whyChooseUs",
  "leads",
] as const satisfies readonly SettingsKey[]
export type EditableSettingsKey = (typeof EDITABLE_SETTINGS_KEYS)[number]

export const SETTINGS_GROUPS = ["General", "Shared sections", "Leads"] as const
export type SettingsGroup = (typeof SETTINGS_GROUPS)[number]

/** Content keys: editors may change them (spec §6.1). */
const CONTENT_UPDATE: PermissionRequest = { settings: ["update"] }

export const SETTINGS_ENTRIES: Record<
  EditableSettingsKey,
  {
    label: string
    description: string
    group: SettingsGroup
    read: PermissionRequest
    update: PermissionRequest
  }
> = {
  site: {
    label: "Site",
    description:
      "Name, logos, production URL, time zone and the copyright line.",
    group: "General",
    read: { settings: ["read"] },
    update: CONTENT_UPDATE,
  },
  contact: {
    label: "Contact details",
    description:
      "Phone numbers, emails, office hours and address used across the site.",
    group: "General",
    read: { settings: ["read"] },
    update: CONTENT_UPDATE,
  },
  navigation: {
    label: "Navigation",
    description:
      "Header links (also the footer quick links) and the header button.",
    group: "General",
    read: { settings: ["read"] },
    update: CONTENT_UPDATE,
  },
  footer: {
    label: "Footer",
    description: "Footer text, headings and the privacy and terms links.",
    group: "General",
    read: { settings: ["read"] },
    update: CONTENT_UPDATE,
  },
  microcopy: {
    label: "Microcopy",
    description: "Small labels, button text and screen-reader labels.",
    group: "General",
    read: { settings: ["read"] },
    update: CONTENT_UPDATE,
  },
  "sections.about": {
    label: "About section",
    description: "Shown on the home page and the About page.",
    group: "Shared sections",
    read: { settings: ["read"] },
    update: CONTENT_UPDATE,
  },
  "sections.contact": {
    label: "Contact section",
    description:
      "Contact details, form labels and map on the home and Contact pages.",
    group: "Shared sections",
    read: { settings: ["read"] },
    update: CONTENT_UPDATE,
  },
  "sections.enquireBanner": {
    label: "Enquire banner",
    description: "The “Enquire about our services” banner on inner pages.",
    group: "Shared sections",
    read: { settings: ["read"] },
    update: CONTENT_UPDATE,
  },
  "sections.clients": {
    label: "Clients strip",
    description: "Heading above the client logos (logos are under Clients).",
    group: "Shared sections",
    read: { settings: ["read"] },
    update: CONTENT_UPDATE,
  },
  "sections.whyChooseUs": {
    label: "Why choose us",
    description: "Heading, text and features of the “Why choose us” section.",
    group: "Shared sections",
    read: { settings: ["read"] },
    update: CONTENT_UPDATE,
  },
  leads: {
    label: "Enquiries",
    description:
      "Who is notified about new enquiries and how long they are kept.",
    group: "Leads",
    read: { settings: ["read"] },
    // Operational, not content: editors cannot change it (spec §6.1).
    update: { settings: ["update"], lead: ["update"] },
  },
}

export function isEditableSettingsKey(
  value: string
): value is EditableSettingsKey {
  return Object.hasOwn(SETTINGS_ENTRIES, value)
}

/** The settings keys these roles may read, in tab order. */
export function readableSettingsKeys(
  roles: readonly string[]
): EditableSettingsKey[] {
  return EDITABLE_SETTINGS_KEYS.filter((key) =>
    hasPermission(roles, SETTINGS_ENTRIES[key].read)
  )
}

/** Where /admin/settings lands (it has no overview page of its own). */
export function firstReadableSettingsKey(
  roles: readonly string[]
): EditableSettingsKey | undefined {
  return readableSettingsKeys(roles)[0]
}
