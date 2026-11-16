import type { HelpArticle } from "../types"

export const SETTINGS_DOCS: readonly HelpArticle[] = [
  {
    slug: "site-settings",
    title: "Site settings",
    group: "settings",
    description: "Identity, enquiry and careers emails, and the live chat.",
    lead: "Site settings holds the details that are not part of a page: the site's identity, who is emailed about enquiries and applications, and the live chat. Each is a draft until you publish.",
    permission: { settings: ["read"] },
    keywords: [
      "identity",
      "logo",
      "production url",
      "notifications",
      "retention",
    ],
    sections: [
      {
        title: "The settings screens",
        blocks: [],
      },
      {
        title: "Identity",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "[Identity](/admin/settings/site) holds the site and legal names, the copyright line, the logos and browser tab icon, the **Production URL** and the time zone of the public site.",
          },
        ],
      },
      {
        title: "Enquiries",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "[Enquiries](/admin/settings/leads) sets **Notify these addresses**, whether visitors get an acknowledgement, and **Keep enquiries for (months)**. Only owners and admins can change it.",
          },
        ],
      },
      {
        title: "Careers",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "[Careers](/admin/settings/careers) sets who is emailed about new applications and how long applications are kept, including those of applicants who asked to stay on file.",
          },
        ],
      },
      {
        title: "Live chat",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "[Live chat](/admin/settings/chat) turns the chat bubble on, lets the AI assistant answer first, and holds every text visitors see in the chat. Only chat managers can change it.",
          },
        ],
      },
      {
        title: "Contact details",
        blocks: [
          {
            type: "p",
            text: "Phone numbers, emails, office hours and the address are edited on the [Contact page](/admin/website/contact), not here. They are used across the site.",
          },
        ],
      },
    ],
  },
  {
    slug: "appearance",
    title: "Appearance",
    group: "settings",
    description: "Colours for the public site and the admin.",
    lead: "[Appearance](/admin/appearance) sets the colours of the public site and of the admin. Changes stay in a draft until you publish.",
    permission: { appearance: ["read"] },
    keywords: ["colours", "colors", "theme", "brand", "dark mode"],
    sections: [
      {
        title: "Working with colours",
        blocks: [],
      },
      {
        title: "Changing colours",
        level: 3,
        blocks: [
          {
            type: "steps",
            items: [
              "Choose the **Site** or **Admin** tab.",
              "Pick a **Preset**, or set the **Brand**, **Primary**, **Accent** and **Neutral tint** colours.",
              "Check the result with **Preview on site**.",
              "Publish.",
            ],
          },
        ],
      },
      {
        title: "Contrast, discard and history",
        level: 3,
        blocks: [
          {
            type: "callout",
            tone: "note",
            text: "Publishing is blocked until every colour pair has enough contrast to read. **Discard draft** throws away your changes; **History** restores an earlier version.",
          },
        ],
      },
    ],
  },
  {
    slug: "ai-assistant",
    title: "AI assistant settings",
    group: "settings",
    description: "Choose the AI provider and who may use it.",
    lead: "[AI assistant](/admin/settings/ai-assistant) connects the assistant to a provider and decides who may use it.",
    permission: { integration: ["read"] },
    keywords: ["ai", "claude", "openai", "gemini", "provider", "api key"],
    sections: [
      {
        title: "Setting it up",
        blocks: [
          {
            type: "list",
            items: [
              "Choose the provider: Anthropic Claude, OpenAI, Google Gemini or an OpenAI-compatible service, and enter its key.",
              "**Who can use it**: owners and admins can always use it.",
              "**Extra instructions** and **Longest answer (tokens)** shape the answers.",
              "**Let the assistant read enquiry details** is off by default and only an owner can turn it on.",
            ],
          },
          {
            type: "p",
            text: "How to use the assistant is in [Using the AI assistant](/admin/help/ai-assistant-panel).",
          },
        ],
      },
    ],
  },
  {
    slug: "integrations",
    title: "Integrations",
    group: "settings",
    description: "Email, media storage and spam protection.",
    lead: "[Integrations](/admin/settings/integrations) connects the site to outside services. Keys are stored encrypted and never shown again.",
    permission: { integration: ["read"] },
    keywords: ["smtp", "email", "r2", "storage", "turnstile", "spam"],
    sections: [
      {
        title: "The services",
        blocks: [],
      },
      {
        title: "Email (SMTP)",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Sends invitations, password resets and enquiry notifications.",
          },
        ],
      },
      {
        title: "Media storage (Cloudflare R2)",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Keeps uploaded images and documents. Until it is set up, uploads stay on the server disk.",
          },
        ],
      },
      {
        title: "Spam protection (Cloudflare Turnstile)",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "An invisible check on the contact form.",
          },
        ],
      },
      {
        title: "Testing a connection",
        blocks: [
          {
            type: "p",
            text: "Use **Test connection** after saving to check the details work. **Disconnect** removes them.",
          },
        ],
      },
    ],
  },
]
