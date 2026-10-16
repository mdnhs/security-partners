import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"

/** Editor labels for the About page (template "about"). The About section itself is in Settings › Shared sections. */
export const aboutEditorMeta: EditorMeta = {
  fields: {
    hero: { label: "Page hero", help: "Banner at the top of the page." },
    "hero.image": { label: "Banner image" },
    "hero.crumb": { label: "Breadcrumb label" },
    "hero.title": { label: "Title" },
    "hero.description": { label: "Introduction" },
    stats: { label: "Stats", itemName: "Stat", itemLabel: "label" },
    values: { label: "Values section" },
    "values.items": { label: "Values", itemName: "Value", itemLabel: "title" },
    "values.items[].icon": { label: "Icon" },
  },
}
