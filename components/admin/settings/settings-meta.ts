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
      logoAlt: { label: "Logo description (alt text)", width: "full" },
      productionUrl: {
        label: "Production URL",
        width: "full",
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
      logo: { label: "Logo", aspect: "square" },
      // Kept in the schema (stored values stay valid) but not edited: the
      // public design has no dark surface with a logo (the footer logo sits
      // on a white plate), so the field would have no effect.
      logoOnDark: {
        label: "Logo on dark backgrounds",
        aspect: "square",
        hidden: true,
      },
      logoAnimation: {
        label: "Animated logo (Lottie)",
        aspect: "square",
        mediaKind: "lottie",
        help: "Plays in a loop in the header and footer. The image logo shows while it loads and for visitors who reduce motion.",
      },
      favicon: { label: "Browser tab icon", aspect: "square" },
    },
    groups: {
      "": [
        {
          title: "Identity",
          description: "The names the site uses for the company.",
          fields: ["name", "legalName", "copyright"],
        },
        {
          title: "Logos",
          description: "Shown in the header, the footer and the browser tab.",
          fields: ["logo", "logoAlt", "logoOnDark", "logoAnimation", "favicon"],
        },
        {
          title: "Production URL",
          description: "Where the live site is published.",
          fields: ["productionUrl"],
        },
        {
          title: "Language and time",
          description: "Used for dates, times and the page language.",
          fields: ["timezone", "locale"],
        },
      ],
    },
  },
  contact: {
    fields: {
      phone24h: { label: "24-hour number", icon: "phone" },
      office: { label: "Office number", icon: "phone" },
      operationsMobile: { label: "Operations mobile", icon: "phone" },
      operationsExtension: { label: "Operations extension" },
      email: { label: "Main email" },
      operationsEmail: { label: "Operations email" },
      hours: { label: "Office hours", icon: "clock", width: "full" },
      addressLine1: { label: "Address line 1", icon: "map" },
      addressLine2: { label: "Address line 2" },
      mapsHref: {
        label: "Map link",
        help: "Opened by “Get directions”.",
        width: "full",
      },
    },
    groups: {
      "": [
        {
          title: "Phone numbers",
          description:
            "Shown in the header, the footer and on the contact page; tel: links are made from them.",
          fields: [
            "phone24h",
            "office",
            "operationsMobile",
            "operationsExtension",
          ],
        },
        {
          title: "Email",
          description: "Where people write to you.",
          fields: ["email", "operationsEmail"],
        },
        {
          title: "Address & map",
          description:
            "Your office address and the map behind “Get directions”.",
          fields: ["addressLine1", "addressLine2", "mapsHref"],
        },
        {
          title: "Opening hours",
          description: "Shown next to the office number.",
          fields: ["hours"],
        },
      ],
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
    groups: {
      "": [
        {
          title: "Menu",
          description: "The links across the top of every page.",
          fields: ["headerLinks"],
        },
        {
          title: "Call to action",
          description: "The highlighted button at the end of the menu.",
          fields: ["headerCta"],
        },
      ],
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
    groups: {
      "": [
        {
          title: "Footer text",
          description: "The tagline and the column headings.",
          fields: [
            "tagline",
            "quickLinksHeading",
            "contactHeading",
            "groupHeading",
            "groupTelLabel",
          ],
        },
      ],
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
    groups: {
      "": [
        {
          title: "Text",
          description: "The heading and copy of the About section.",
          fields: ["eyebrow", "heading", "body"],
        },
        {
          title: "Image",
          fields: ["image", "imageAlt"],
        },
        {
          title: "Highlights",
          description: "The ticked list beside the text.",
          fields: ["highlights"],
        },
      ],
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
      "infoItems[].icon": { label: "Icon", aspect: "square" },
      "infoItems[].lines": {
        label: "Lines",
        itemName: "Line",
        itemLabel: "text",
      },
      form: { label: "Contact form" },
      "form.sendingLabel": { label: "Button text while sending" },
      "form.successMessage": {
        label: "Message after sending",
        widget: "textarea",
        rows: 2,
      },
      "form.errorMessage": {
        label: "Message when sending fails",
        widget: "textarea",
        rows: 2,
      },
      "form.rateLimitedMessage": {
        label: "Message after too many attempts",
        help: "Shown when one visitor sends more than 5 messages in 10 minutes.",
        widget: "textarea",
        rows: 2,
      },
      "form.mailtoSubject": {
        label: "Notification email subject",
        help: "Subject of the email staff receive for each enquiry. {name} is the visitor's name.",
      },
      map: { label: "Map" },
      "map.tiles": {
        label: "Map tile address",
        help: "{col} and {row} are filled in for each tile.",
        width: "full",
      },
    },
    groups: {
      "": [
        {
          title: "Heading",
          description: "The top of the Contact section.",
          fields: ["eyebrow", "heading", "intro"],
        },
        {
          title: "Contact blocks",
          description: "The cards with numbers, emails and the address.",
          fields: ["infoItems"],
        },
      ],
    },
  },
  "sections.enquireBanner": {
    fields: {
      image: { label: "Background image" },
      cta: { label: "Main button" },
      secondaryCta: { label: "Second button", help: PLACEHOLDER_HELP },
    },
    groups: {
      "": [
        {
          title: "Text",
          fields: ["eyebrow", "heading", "copy"],
        },
        {
          title: "Background",
          description: "The photo behind the banner.",
          fields: ["image"],
        },
        { title: "Buttons", fields: ["cta", "secondaryCta"] },
      ],
    },
  },
  "sections.clients": {
    fields: {},
    groups: {
      "": [
        {
          title: "Heading",
          description: "Above the strip of client logos.",
          fields: ["eyebrow", "heading"],
        },
      ],
    },
  },
  "sections.whyChooseUs": {
    fields: {
      features: { label: "Features", itemName: "Feature", itemLabel: "title" },
      "features[].icon": { label: "Icon", aspect: "square" },
    },
    groups: {
      "": [
        { title: "Text", fields: ["eyebrow", "heading", "copy"] },
        {
          title: "Features",
          description: "The reasons, each with an icon.",
          fields: ["features"],
        },
      ],
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
        width: "full",
      },
    },
    groups: {
      "": [
        {
          title: "Notifications",
          description: "Who hears about a new enquiry.",
          fields: ["recipients", "acknowledgement"],
        },
        {
          title: "Retention",
          description: "How long enquiries are kept.",
          fields: ["retentionMonths"],
        },
      ],
    },
  },
}
