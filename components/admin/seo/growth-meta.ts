import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"
import {
  type GrowthSettingsKey,
  TRACKING_TAG_FIELDS,
} from "@/lib/admin/growth-settings"

const TAG_OWNER_ONLY =
  "Only an owner can change this ID: the tags it loads can run any code on this site, the admin included."

/**
 * The key's editor meta for this user. Tracking tag IDs are owner-only
 * (final review I1; the API enforces it): without that right they are
 * read-only and say why.
 */
export function growthMetaFor(
  key: GrowthSettingsKey,
  { canEditTrackingTags }: { canEditTrackingTags: boolean }
): EditorMeta {
  const meta = growthEditorMeta[key]
  if (key !== "tracking" || canEditTrackingTags) return meta
  const fields = { ...meta.fields }
  for (const name of TRACKING_TAG_FIELDS)
    fields[name] = {
      ...fields[name],
      readOnly: true,
      help: `${fields[name]?.help ?? ""} ${TAG_OWNER_ONLY}`.trim(),
    }
  return { ...meta, fields }
}

/** Editor hints for SEO defaults, tracking, consent and custom code. */
export const growthEditorMeta: Record<GrowthSettingsKey, EditorMeta> = {
  "seo.defaults": {
    fields: {
      title: {
        label: "Home page title",
        help: "The home page's browser-tab and search-result title.",
      },
      titleTemplate: {
        label: "Title pattern",
        help: "{title} is replaced by each page's name, e.g. “{title} | Security Partners Ltd.”.",
      },
      description: {
        label: "Default description",
        help: "Used by pages without a description of their own. Aim for 50–160 characters.",
        maxLength: 160,
      },
      ogImage: {
        label: "Default share image",
        help: "Used when a page has no share image. Leave empty to generate a card with each page's title. Best at 1200 × 630.",
      },
      organization: {
        label: "Business details for search engines",
        section: true,
      },
      "organization.type": {
        label: "Business type",
        widget: "select",
        options: [
          { value: "LocalBusiness", label: "Local business" },
          { value: "ProfessionalService", label: "Professional service" },
        ],
      },
      "organization.streetAddress": { label: "Street address" },
      "organization.addressLocality": { label: "Town" },
      "organization.addressRegion": { label: "County" },
      "organization.postalCode": { label: "Eircode" },
      "organization.addressCountry": {
        label: "Country code",
        help: "Two capital letters, e.g. IE.",
      },
      "organization.areaServed": {
        label: "Area served",
        help: "e.g. Ireland, or Leinster.",
      },
      "organization.sameAs": {
        label: "Official profiles",
        itemName: "Profile link",
        help: "Full links to the company's own LinkedIn, Facebook … pages.",
      },
    },
  },
  tracking: {
    fields: {
      enabled: {
        label: "Load tracking",
        help: "On: visitors see the cookie banner, and the tags switched on below load only after they agree. Off: no banner and no tracking at all.",
      },
      gtmEnabled: {
        label: "Use Google Tag Manager",
        help: "Loads Tag Manager with the ID below once a visitor accepts analytics cookies.",
      },
      gtmId: {
        label: "Google Tag Manager ID",
        placeholder: "GTM-XXXXXXX",
        help: "Loads after a visitor accepts analytics cookies.",
      },
      ga4Enabled: {
        label: "Use Google Analytics 4",
        help: "Loads Analytics with the ID below once a visitor accepts analytics cookies.",
      },
      ga4Id: {
        label: "Google Analytics 4 ID",
        placeholder: "G-XXXXXXXXXX",
        help: "Loads after analytics consent. Use this or Tag Manager for Analytics, not both, or visits are counted twice.",
      },
      metaEnabled: {
        label: "Use Meta Pixel",
        help: "Loads the pixel with the ID below once a visitor accepts marketing cookies.",
      },
      metaPixelId: {
        label: "Meta Pixel ID",
        placeholder: "1234567890",
        help: "Loads after a visitor accepts marketing cookies.",
      },
    },
  },
  consent: {
    fields: {
      title: { label: "Banner title" },
      body: { label: "Banner text", rows: 3 },
      acceptLabel: { label: "Accept button" },
      rejectLabel: { label: "Reject button" },
      customiseLabel: { label: "Customise button" },
      saveLabel: { label: "Save choices button" },
      manageLabel: {
        label: "Reopen button",
        help: "The small button that lets visitors change their choice later.",
      },
      closeLabel: {
        label: "Close button (screen readers)",
        help: "Read aloud for the × that closes the reopened banner.",
      },
      policyLink: { label: "Privacy policy link" },
      categories: { label: "Cookie categories", section: true },
      "categories.necessary": { label: "Necessary (always on)" },
      "categories.analytics": { label: "Analytics" },
      "categories.marketing": { label: "Marketing" },
      version: {
        label: "Consent version",
        help: "Raise it by 1 when what you ask consent for changes: every visitor sees the banner again, and nothing loads until they choose.",
      },
      reconsentMonths: {
        label: "Ask again after (months)",
        help: "How long a visitor's choice is kept before the banner asks again. 1 to 6 months.",
      },
    },
  },
  customCode: {
    fields: {
      headHtml: {
        label: "Code in <head>",
        rows: 10,
        help: "Added to the <head> of every public page after it loads.",
      },
      bodyEndHtml: {
        label: "Code at the end of <body>",
        rows: 10,
        help: "Added at the end of every public page after it loads.",
      },
    },
  },
}
