import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"
import type { EditableSettingsKey } from "@/lib/admin/settings-keys"

const PLACEHOLDER_HELP =
  "Placeholders such as {phone24h} or {officeHref} are filled from Contact details."

const CHAT_TEMPLATE_HELP = "{team}, {botName} and {agent} are filled in."
const CHAT_NOTICE_HELP = "Shown once in the chat. {team} is filled in."
const chatNotice = (label: string, help = CHAT_NOTICE_HELP) => ({
  label,
  help,
  widget: "textarea" as const,
  rows: 2,
  width: "full" as const,
})

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
  careers: {
    fields: {
      recipients: {
        label: "Notify these addresses",
        itemName: "Recipient",
        help: "Each new job application is emailed to every address (no CV attached: it stays in the admin).",
      },
      retentionMonths: {
        label: "Keep applications for (months)",
        help: "Older applications, with their CVs and PSA cards, are deleted automatically. Shown as {months} in the apply form’s privacy copy.",
      },
      keepOnFileMonths: {
        label: "Keep on file for (months)",
        help: "Instead, for applicants who tick “keep my details on file”. Shown as {keepMonths} in that consent.",
      },
    },
    groups: {
      "": [
        {
          title: "Notifications",
          description: "Who hears about a new application.",
          fields: ["recipients"],
        },
        {
          title: "Retention",
          description: "How long applications are kept.",
          fields: ["retentionMonths", "keepOnFileMonths"],
        },
      ],
    },
  },
  chat: {
    fields: {
      enabled: { label: "Show the chat on the site", width: "full" },
      teamName: {
        label: "Team name",
        help: "Filled in wherever a text says {team}.",
      },
      bot: { label: "AI assistant" },
      "bot.enabled": {
        label: "AI assistant answers first",
        help: "Needs the AI assistant set up under Site settings › AI assistant. Chats are sent to that provider.",
        width: "full",
      },
      "bot.name": { label: "Assistant name" },
      "bot.extraInstructions": {
        label: "Extra instructions",
        widget: "textarea",
        rows: 4,
        width: "full",
      },
      "bot.maxAiReplies": { label: "Assistant replies per chat" },
      hint: { label: "Hint" },
      "hint.title": { label: "Title" },
      "hint.subtitle": { label: "Subtitle" },
      "hint.presets": {
        label: "Questions",
        itemName: "Question",
        itemLabel: "label",
      },
      "hint.presets[].label": { label: "Question" },
      "hint.presets[].message": {
        label: "Message",
        help: "Typed into the message box when picked. Leave empty to just open the chat.",
      },
      copy: { label: "Widget text" },
      "copy.launcherOpen": { label: "Chat button (screen readers)" },
      "copy.launcherOpenUnread": {
        label: "Chat button with a new message (screen readers)",
      },
      "copy.close": { label: "Close button (screen readers)" },
      "copy.hintGroup": { label: "Hint questions (screen readers)" },
      "copy.hintDismiss": { label: "Hide hint button (screen readers)" },
      "copy.title": { label: "Title" },
      "copy.welcome": { label: "Welcome line" },
      "copy.statusReconnecting": { label: "Reconnecting" },
      "copy.statusAgent": {
        label: "Chatting with a person",
        help: CHAT_TEMPLATE_HELP,
      },
      "copy.statusBot": {
        label: "Chatting with the assistant",
        help: CHAT_TEMPLATE_HELP,
      },
      "copy.statusOnline": { label: "Team online" },
      "copy.statusOffline": { label: "Team offline" },
      "copy.conversation": { label: "Conversation (screen readers)" },
      "copy.aiCaption": {
        label: "Caption under assistant replies",
        help: CHAT_TEMPLATE_HELP,
      },
      "copy.typing": { label: "Typing", help: CHAT_TEMPLATE_HELP },
      "copy.messageLabel": { label: "Message box label (screen readers)" },
      "copy.messagePlaceholder": { label: "Message box placeholder" },
      "copy.send": { label: "Send button (screen readers)" },
      "copy.startNew": { label: "Start a new chat button" },
      "copy.connecting": { label: "Connecting" },
      "copy.consentBot": {
        label: "Consent line with the assistant on",
        help: CHAT_TEMPLATE_HELP,
        width: "full",
      },
      "copy.consentTeam": {
        label: "Consent line with the assistant off",
        help: CHAT_TEMPLATE_HELP,
        width: "full",
      },
      "copy.privacyLabel": { label: "Privacy link text" },
      "copy.privacyHref": { label: "Privacy link address" },
      "copy.offlineNote": {
        label: "Email request",
        help: CHAT_TEMPLATE_HELP,
        width: "full",
      },
      "copy.emailPlaceholder": { label: "Email box placeholder" },
      "copy.emailSave": { label: "Save email button" },
      "copy.emailDismiss": { label: "Hide email request button" },
      "copy.emailError": { label: "Email error" },
      "copy.noticeOffline": { label: "Visitor offline" },
      "copy.noticeRate": { label: "Sending too fast" },
      "copy.noticeEnded": { label: "Chat ended" },
      "copy.errorTooLong": { label: "Message too long" },
      "copy.errorStart": { label: "Chat could not start" },
      "copy.errorGeneric": { label: "Other error" },
      notices: { label: "Messages in the chat" },
      // The assistant no longer hands a chat over on its own (2026-11-15).
      "notices.handoff": {
        ...chatNotice("Assistant asks for a person"),
        hidden: true,
      },
      "notices.limit": chatNotice("Assistant reply limit reached"),
      "notices.failed": chatNotice("Assistant unavailable"),
      "notices.joined": chatNotice(
        "Team member joined",
        "Shown each time a team member takes the chat over, by replying or with Take over. {name} is filled in."
      ),
      "notices.back": chatNotice(
        "Assistant back on",
        "Shown each time the chat is handed back to the assistant. {team} is filled in."
      ),
      "notices.ended": chatNotice(
        "Chat closed",
        "Shown when the chat is closed. {team} is filled in."
      ),
      alerts: { label: "Alerts" },
      "alerts.includeMessage": {
        label: "Include the visitor's message in alert emails",
        width: "full",
      },
      retentionMonths: {
        label: "Keep chats for (months)",
        help: "Chats older than this are deleted automatically.",
      },
    },
    groups: {
      "": [
        {
          title: "Chat",
          description: "Whether visitors see the chat, and who answers it.",
          fields: ["enabled", "teamName"],
        },
        {
          title: "AI assistant",
          description: "The assistant that answers before a person joins.",
          fields: ["bot"],
        },
        {
          title: "Hint",
          description: "The note above the chat button and its questions.",
          fields: ["hint"],
        },
        {
          title: "Widget text",
          description: "Every text visitors see in the chat window.",
          fields: ["copy"],
        },
        {
          title: "Messages in the chat",
          description:
            "Notes stored in the conversation when it changes hands.",
          fields: ["notices"],
        },
        {
          title: "Alerts and retention",
          description:
            "Alert emails to the Enquiries addresses and how long chats are kept.",
          fields: ["alerts", "retentionMonths"],
        },
      ],
      copy: [
        {
          title: "Chat button and hint",
          fields: [
            "launcherOpen",
            "launcherOpenUnread",
            "close",
            "hintGroup",
            "hintDismiss",
          ],
        },
        { title: "Header", fields: ["title", "welcome"] },
        {
          title: "Status line",
          fields: [
            "statusReconnecting",
            "statusAgent",
            "statusBot",
            "statusOnline",
            "statusOffline",
          ],
        },
        {
          title: "Conversation",
          fields: ["conversation", "aiCaption", "typing"],
        },
        {
          title: "Message box",
          fields: [
            "messageLabel",
            "messagePlaceholder",
            "send",
            "startNew",
            "connecting",
          ],
        },
        {
          title: "Consent line",
          fields: ["consentBot", "consentTeam", "privacyLabel", "privacyHref"],
        },
        {
          title: "Email request",
          fields: [
            "offlineNote",
            "emailPlaceholder",
            "emailSave",
            "emailDismiss",
            "emailError",
          ],
        },
        {
          title: "Notices and errors",
          fields: [
            "noticeOffline",
            "noticeRate",
            "noticeEnded",
            "errorTooLong",
            "errorStart",
            "errorGeneric",
          ],
        },
      ],
    },
  },
}
