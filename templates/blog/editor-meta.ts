import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"

/** Editor labels for the Blog page (template "blog"). Articles are edited under Articles. */
export const blogEditorMeta: EditorMeta = {
  fields: {
    hero: { label: "Page hero", help: "Banner at the top of the page." },
    "hero.image": { label: "Banner image" },
    "hero.crumb": { label: "Breadcrumb label" },
    "hero.title": { label: "Title" },
    "hero.description": { label: "Introduction" },
    featuredArticle: {
      label: "Featured article",
      widget: "collection",
      collection: "articles",
      help: "Shown large above the list. None = the newest article.",
    },
    pageSize: { label: "Articles per page" },
  },
}
