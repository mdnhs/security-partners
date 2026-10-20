import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"

/** Labels and help for a record's SEO fields (lib/schemas/common.ts `seo`). */
export const SEO_FIELDS_META: EditorMeta = {
  fields: {
    title: {
      label: "Title",
      help: "Browser tab and search-result headline. Leave empty to use the page name with the site's title pattern. Aim for 15–60 characters.",
      maxLength: 60,
    },
    description: {
      label: "Description",
      help: "The search-result snippet. Leave empty to use the page's own summary or the site default. Aim for 50–160 characters.",
      maxLength: 160,
      rows: 3,
    },
    canonical: {
      label: "Canonical address",
      help: "Only when the main copy of this content lives at another address. Normally empty.",
      // z.string().pipe(httpUrl): a text input (resolveWidget edits a pipe's
      // input); the name alone would not give it the link icon.
      icon: "url",
      placeholder: "https://",
    },
    ogImage: {
      label: "Share image",
      help: "Shown when the page is shared on social networks. Empty: the site default, or a generated card with the page title. Best at 1200 × 630.",
    },
    noindex: {
      label: "Hide from search engines",
      help: "Adds noindex and leaves the page out of the sitemap.",
    },
    ogTitle: {
      label: "Social title",
      help: "The headline when the page is shared on social networks. Empty: the title above.",
      maxLength: 70,
    },
    ogDescription: {
      label: "Social description",
      help: "The text under the headline when shared. Empty: the description above.",
      maxLength: 200,
      rows: 3,
    },
    twitterCard: {
      label: "Card on X (Twitter)",
      help: "A large image above the text, or a small square beside it.",
      options: [
        { value: "summary_large_image", label: "Large image" },
        { value: "summary", label: "Small image" },
      ],
    },
  },
}
