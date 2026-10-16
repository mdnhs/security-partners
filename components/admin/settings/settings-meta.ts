import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"
import type { EditableSettingsKey } from "@/lib/admin/settings-keys"

const PLACEHOLDER_HELP =
  "Placeholders such as {phone24h} or {officeHref} are filled from Contact details."

/** Editor hints per settings key (labels default to the field name). */
export const settingsEditorMeta: Record<EditableSettingsKey, EditorMeta> = {
  site: {
    fields: {
      name: { label: "Site name" },
      legalName: { label: "Legal name" },
      logo: { label: "Logo" },
      logoAlt: { label: "Logo description (alt text)" },
      logoOnDark: { label: "Logo on dark backgrounds" },
      favicon: { label: "Browser tab icon" },
      productionUrl: {
        label: "Production URL",
        help: "The live address, e.g. https://www.securitypartnersltd.com. Decides whether this copy of the site counts as production.",
      },
      timezone: { label: "Time zone", help: "IANA name, e.g. Europe/Dublin." },
      locale: {
        label: "Language",
        help: "Language tag of the public site, e.g. en.",
      },
      copyright: {
        label: "Copyright line",
        help: "{year} is replaced with the current year.",
      },
    },
  },
  contact: {
    fields: {
      phone24h: { label: "24-hour number" },
      office: { label: "Office number" },
      operationsMobile: { label: "Operations mobile" },
      operationsExtension: { label: "Operations extension" },
      email: { label: "Main email" },
      operationsEmail: { label: "Operations email" },
      hours: { label: "Office hours" },
      addressLine1: { label: "Address line 1" },
      addressLine2: { label: "Address line 2" },
      mapsHref: { label: "Map link", help: "Opened by “Get directions”." },
    },
  },
  navigation: {
    fields: {
      headerLinks: {
        label: "Header links",
        itemName: "Link",
        itemLabel: "label",
        help: "Also listed as Quick links in the footer.",
      },
      headerCta: { label: "Header button" },
    },
  },
  footer: {
    fields: {
      tagline: { label: "Tagline" },
      contact: { label: "Contact column" },
      legal: { label: "Legal links" },
      "legal.privacy": { label: "Privacy link" },
      "legal.terms": { label: "Terms link" },
    },
  },
  microcopy: {
    fields: {
      header: { label: "Header" },
      aria: {
        label: "Screen-reader labels",
        help: "Not visible; read aloud by assistive technology.",
      },
      breadcrumb: { label: "Breadcrumbs" },
      serviceCard: { label: "Service cards" },
      service: { label: "Service pages", help: PLACEHOLDER_HELP },
      blog: { label: "Blog" },
      article: {
        label: "Articles",
        help: "{n} is the reading time in minutes.",
      },
      share: { label: "Share buttons" },
      "share.networks": {
        label: "Networks",
        itemName: "Network",
        itemLabel: "name",
      },
    },
  },
  "sections.about": {
    fields: {
      body: { label: "Text" },
      image: { label: "Image" },
      imageAlt: { label: "Image description (alt text)" },
      badge: { label: "Badge" },
      highlights: { label: "Highlights", itemName: "Highlight" },
    },
  },
  "sections.contact": {
    fields: {
      infoItems: {
        label: "Contact blocks",
        itemName: "Block",
        itemLabel: "title",
        help: PLACEHOLDER_HELP,
      },
      "infoItems[].lines": {
        label: "Lines",
        itemName: "Line",
        itemLabel: "text",
      },
      form: { label: "Contact form" },
      "form.mailtoSubject": { label: "Email subject" },
      map: { label: "Map" },
      "map.tiles": {
        label: "Map tile address",
        help: "{col} and {row} are filled in for each tile.",
      },
    },
  },
  "sections.enquireBanner": {
    fields: {
      image: { label: "Background image" },
      cta: { label: "Main button" },
      secondaryCta: { label: "Second button", help: PLACEHOLDER_HELP },
    },
  },
  "sections.clients": { fields: {} },
  "sections.whyChooseUs": {
    fields: {
      features: { label: "Features", itemName: "Feature", itemLabel: "title" },
      "features[].icon": { label: "Icon" },
    },
  },
  leads: {
    fields: {
      recipients: {
        label: "Notify these addresses",
        itemName: "Recipient",
        help: "Each new enquiry is emailed to every address.",
      },
      retentionMonths: {
        label: "Keep enquiries for (months)",
        help: "Older enquiries are deleted automatically.",
      },
      acknowledgement: {
        label: "Send an acknowledgement",
        help: "Email the person who sent the enquiry to confirm it arrived.",
      },
    },
  },
}
