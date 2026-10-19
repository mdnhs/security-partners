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
        required: true,
        help: "Raise it by 1 when what you ask consent for changes: every visitor sees the banner again, and nothing loads until they choose. It can't go below the published version.",
      },
      reconsentMonths: {
        label: "Ask again after (months)",
        help: "How long a visitor's choice is kept before the banner asks again. 1 to 6 months.",
      },
    },
  },
  customCode: {
    fields: {
      disabled: {
        label: "Switch all custom code off",
        help: "Kill switch: while on, no snippet runs on the public site. Also set by `pnpm custom-code:off` on the server when you cannot sign in.",
      },
      allowedHosts: {
        label: "Allowed hosts",
        itemName: "Host",
        help: "Script addresses must be https:// on one of these hosts, e.g. www.googletagmanager.com. This checks the Script address field only: scripts inside HTML blocks, and whatever a script loads, are not checked.",
      },
      "allowedHosts[]": { label: "Host", placeholder: "cdn.example.com" },
      snippets: {
        label: "Snippets",
        itemName: "Snippet",
        itemLabel: "name",
        help: "Each snippet is a script address or an HTML block, not both.",
      },
      "snippets[].id": { hidden: true },
      "snippets[].name": {
        label: "Name",
        help: "For you only; never sent to visitors.",
      },
      "snippets[].enabled": { label: "On" },
      "snippets[].placement": {
        label: "Where",
        widget: "radio",
        options: [
          { value: "head", label: "In <head>" },
          { value: "body", label: "End of <body>" },
        ],
      },
      "snippets[].category": {
        label: "Consent needed",
        widget: "radio",
        options: [
          { value: "necessary", label: "None (necessary)" },
          { value: "analytics", label: "Analytics" },
          { value: "marketing", label: "Marketing" },
        ],
        help: "Anything that sets cookies or tracks visitors needs Analytics or Marketing: it then waits for the visitor's consent (and never runs while tracking is off). The consent check runs in the visitor's browser, like any page script.",
      },
      "snippets[].src": {
        label: "Script address",
        placeholder: "https://cdn.example.com/widget.js",
        help: "Loaded as <script async>. Leave empty to use HTML.",
        width: "full",
      },
      "snippets[].html": {
        label: "HTML",
        widget: "textarea",
        rows: 8,
        help: "Added after the page loads. Leave empty to use a script address.",
      },
      "snippets[].routes": {
        label: "Pages",
        itemName: "Page",
        help: 'Leave empty for every page. "/" is the home page only; "/blog/*" is the blog and everything under it. Every snippet\'s code and pages are sent to the browser on all pages; only where it runs is limited. Once started, it stays for the rest of the visit (until a full page load).',
      },
      "snippets[].routes[]": { label: "Page", placeholder: "/blog/*" },
    },
  },
}
