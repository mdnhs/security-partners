import type { HelpArticle } from "../types"

export const GROWTH_DOCS: readonly HelpArticle[] = [
  {
    slug: "seo",
    title: "SEO overview and defaults",
    group: "growth",
    description: "How search engines see the site, and the site-wide defaults.",
    lead: "[SEO](/admin/seo) shows how search engines see the site. Each page's own title and description are on its **SEO** tab; the site-wide fallbacks are in [Defaults](/admin/seo/defaults).",
    permission: { seo: ["read"] },
    keywords: ["google", "search", "meta", "title", "description", "sitemap"],
    sections: [
      {
        title: "Site-wide settings",
        blocks: [],
      },
      {
        title: "Overview",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "**SEO health** runs checks on the published pages. **Pages and posts** lists every page, service and article with an **Edit SEO** button that opens its SEO tab.",
          },
        ],
      },
      {
        title: "Defaults",
        level: 3,
        blocks: [
          {
            type: "list",
            items: [
              "**Home page title**, **Title pattern**, **Default description** and **Default share image**: used when a page does not set its own.",
              "**Business details**: what search engines show about the company.",
              "**Search engines**: **Hide the whole site from search** blocks crawlers. Use it only for a site that is not ready.",
              "**Verification**: codes for Google Search Console and Bing Webmaster Tools.",
            ],
          },
          {
            type: "p",
            text: "Defaults are a draft until you publish. **What crawlers see** previews the robots.txt and the sitemap.",
          },
        ],
      },
      {
        title: "Per page",
        blocks: [],
      },
      {
        title: "A page's SEO tab",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Page, service and article editors have an **SEO** tab beside **Content**. Its changes go live as soon as you save. **Hide from search engines** also leaves the page out of the sitemap.",
          },
        ],
      },
    ],
  },
  {
    slug: "redirects",
    title: "Redirects",
    group: "growth",
    description: "Send an old address to a new one.",
    lead: "[Redirects](/admin/seo/redirects) send visitors and search engines from an old address to a new one. Renamed or deleted services and articles are redirected automatically, marked Automatic.",
    permission: { redirect: ["read"] },
    keywords: ["301", "302", "404", "moved", "old url"],
    sections: [
      {
        title: "Managing redirects",
        blocks: [],
      },
      {
        title: "Add a redirect",
        level: 3,
        blocks: [
          {
            type: "steps",
            items: [
              "Select **Add redirect**.",
              "Enter the **Old address** and the **New address**.",
              "Choose the **Type**. Use 301 for a permanent move.",
              "Save. Redirects work straight away.",
            ],
          },
        ],
      },
      {
        title: "Turn off, export and import",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "**Turn off** stops a redirect without deleting it. **Export CSV** and **Import CSV** move many redirects at once.",
          },
        ],
      },
    ],
  },
  {
    slug: "canonical-urls",
    title: "Canonical URLs",
    group: "growth",
    description: "The site's main address and each page's canonical address.",
    lead: "[Canonical URLs](/admin/seo/canonical) sets the site's main address and the address each page tells search engines to index.",
    permission: { seo: ["read"] },
    keywords: ["canonical", "www", "https", "duplicate", "preferred address"],
    sections: [
      {
        title: "Setting canonical URLs",
        blocks: [],
      },
      {
        title: "Preferred address",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "http://, https://, with and without www are four addresses to Google. Choose the **Main address** and the other three redirect to it.",
          },
          {
            type: "list",
            items: [
              "**Off** keeps all four addresses working.",
              "**Without www** or **With www** picks the main one.",
            ],
          },
          {
            type: "p",
            text: "The change is live when saved and takes effect within a minute. It needs the **Production URL** in [Identity](/admin/settings/site); without it the card is turned off.",
          },
        ],
      },
      {
        title: "Each page's canonical address",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "The list shows every page, service, article and custom page. **Self** means the page points to itself, which is right for almost every page. **Custom** means it points elsewhere.",
          },
          {
            type: "steps",
            items: [
              "Select **Edit** on a row.",
              "Enter the **Canonical address**, or select **Use the page itself**.",
              "Save. The change is live at once.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "marketing",
    title: "Tracking and consent",
    group: "growth",
    description: "Google Tag Manager, GA4, Meta Pixel and the cookie banner.",
    lead: "[Marketing](/admin/marketing) connects analytics tools and sets the cookie banner visitors use to accept or refuse them.",
    permission: { marketing: ["read"] },
    keywords: [
      "analytics",
      "gtm",
      "ga4",
      "pixel",
      "cookies",
      "consent",
      "gdpr",
    ],
    sections: [
      {
        title: "The Marketing screens",
        blocks: [],
      },
      {
        title: "Tracking",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Turn on **Load tracking**, then choose **Use Google Tag Manager**, **Use Google Analytics 4** (use this or Tag Manager, not both) or **Use Meta Pixel**. Turning tracking on shows the cookie banner.",
          },
          {
            type: "callout",
            tone: "warning",
            text: "Only an owner can change the IDs: the tags they load can run any code on the site, the admin included.",
          },
        ],
      },
      {
        title: "Consent banner",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "[Consent banner](/admin/marketing/consent) sets the banner's title, text, button labels and cookie categories. Raise the **Consent version** to ask every visitor again.",
          },
        ],
      },
      {
        title: "Event catalogue",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "[Event catalogue](/admin/marketing/events) lists the events the site sends to analytics, such as an enquiry being sent or a phone number being clicked. It is for reference and cannot be edited.",
          },
        ],
      },
      {
        title: "Publishing",
        blocks: [
          {
            type: "p",
            text: "Tracking and the consent banner are drafts until you publish.",
          },
        ],
      },
    ],
  },
  {
    slug: "custom-code",
    title: "Custom code",
    group: "growth",
    description: "Add scripts or HTML to every public page. Owner only.",
    lead: "[Custom code](/admin/marketing/code) adds snippets to the public site. Code here runs on every page, so only owners can open it.",
    permission: { customCode: ["read"] },
    keywords: ["script", "snippet", "head", "html", "csp"],
    sections: [
      {
        title: "Add a snippet",
        blocks: [
          {
            type: "steps",
            items: [
              "Add a snippet and give it a **Name**.",
              "Choose **Where**: in the head or at the end of the body.",
              "Enter a **Script address** or the **HTML**, and the **Pages** it runs on.",
              "Set **Consent needed** if it tracks visitors.",
              "Publish.",
            ],
          },
          {
            type: "callout",
            tone: "warning",
            text: "**Switch all custom code off** stops every snippet at once if something breaks the site.",
          },
        ],
      },
    ],
  },
]
