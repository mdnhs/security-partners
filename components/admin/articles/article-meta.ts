import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"

/** Editor hints for an article (card on /blog + its own page). */
export const articleEditorMeta: EditorMeta = {
  fields: {
    title: { label: "Title" },
    excerpt: {
      label: "Excerpt",
      widget: "textarea",
      help: "Shown on blog cards. Also the intro when there is no lead.",
    },
    cover: { label: "Cover image" },
    lead: {
      label: "Lead",
      widget: "textarea",
      help: "The large intro under the title. Leave empty to use the excerpt.",
    },
    tags: {
      label: "Tags",
      itemName: "Tag",
      help: "Leave empty to show the category as the only tag.",
    },
    body: {
      label: "Article text",
      help: "Leave empty to show the excerpt instead.",
    },
  },
}
