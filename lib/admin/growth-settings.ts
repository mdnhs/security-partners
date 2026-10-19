import type { PermissionRequest } from "@/lib/auth/permissions"
import type { SettingsKey } from "@/lib/schemas/settings"

/**
 * Settings edited under Growth (SEO › Defaults, Marketing › …), not under
 * Settings (master 4.5 excludes them). Each key has its own permissions
 * (spec §6.1): custom code is owner-only.
 */
export const GROWTH_SETTINGS_KEYS = [
  "seo.defaults",
  "tracking",
  "consent",
  "customCode",
] as const satisfies readonly SettingsKey[]
export type GrowthSettingsKey = (typeof GROWTH_SETTINGS_KEYS)[number]

export const GROWTH_SETTINGS: Record<
  GrowthSettingsKey,
  {
    label: string
    description: string
    href: string
    read: PermissionRequest
    update: PermissionRequest
  }
> = {
  "seo.defaults": {
    label: "SEO defaults",
    description:
      "Title pattern, default description and share image, and the business details search engines show.",
    href: "/admin/seo/defaults",
    read: { seo: ["read"] },
    update: { seo: ["update"] },
  },
  tracking: {
    label: "Tracking",
    description:
      "Google Tag Manager, Google Analytics 4 and Meta Pixel. Turning tracking on shows the cookie banner.",
    href: "/admin/marketing",
    read: { marketing: ["read"] },
    update: { marketing: ["update"] },
  },
  consent: {
    label: "Consent banner",
    description: "Wording of the cookie banner and its categories.",
    href: "/admin/marketing/consent",
    read: { marketing: ["read"] },
    update: { marketing: ["update"] },
  },
  customCode: {
    label: "Custom code",
    description: "Snippets added to every public page. Owner only.",
    href: "/admin/marketing/code",
    read: { customCode: ["read"] },
    update: { customCode: ["update"] },
  },
}

/**
 * Tracking fields that make every public page load a third-party script
 * (final review I1). A GTM container can ship Custom HTML, i.e. any code,
 * and the admin shares the public origin, so changing one of these is the
 * same capability as custom code: owner-only. The enable toggle stays with
 * marketing.
 */
export const TRACKING_TAG_FIELDS = ["gtmId", "ga4Id", "metaPixelId"] as const
export const TRACKING_TAG_UPDATE: PermissionRequest = {
  customCode: ["update"],
}

const tagValue = (data: unknown, field: string): unknown =>
  data && typeof data === "object"
    ? ((data as Record<string, unknown>)[field] ?? null)
    : null

/** Whether `after` loads a different tag than `before` (null/absent = none). */
export function trackingTagsChanged(before: unknown, after: unknown): boolean {
  return TRACKING_TAG_FIELDS.some(
    (field) => tagValue(before, field) !== tagValue(after, field)
  )
}

export function isGrowthSettingsKey(value: string): value is GrowthSettingsKey {
  return Object.hasOwn(GROWTH_SETTINGS, value)
}
