import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"

/** Editor labels for the Services page (template "services"). Service cards are edited under Services. */
export const servicesEditorMeta: EditorMeta = {
  fields: {
    hero: { label: "Page hero", help: "Banner at the top of the page." },
    "hero.image": { label: "Banner image" },
    "hero.crumb": { label: "Breadcrumb label" },
    "hero.title": { label: "Title" },
    "hero.description": { label: "Introduction" },
    servicesSection: { label: "Services section" },
  },
}
