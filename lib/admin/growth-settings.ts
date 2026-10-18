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
    href: "/admin/marketing/tracking",
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
    href: "/admin/marketing/custom-code",
    read: { customCode: ["read"] },
    update: { customCode: ["update"] },
  },
}

export function isGrowthSettingsKey(value: string): value is GrowthSettingsKey {
  return Object.hasOwn(GROWTH_SETTINGS, value)
}
