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
      // A z.string().pipe(httpUrl) (raw text checked first): no automatic widget.
      widget: "text",
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
  },
}
