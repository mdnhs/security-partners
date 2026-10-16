import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"

import { PAGE_HERO_GROUPS } from "../shared/editor-groups"

/** Editor labels for the Privacy and Terms pages (template "legal"). */
export const legalEditorMeta: EditorMeta = {
  fields: {
    hero: { label: "Page hero", help: "Banner at the top of the page." },
    "hero.image": { label: "Banner image" },
    "hero.crumb": { label: "Breadcrumb label" },
    "hero.title": { label: "Title" },
    "hero.description": { label: "Introduction" },
    body: {
      label: "Text",
      help: "Headings, lists, quotes and links use the article styles.",
    },
  },
  groups: { hero: PAGE_HERO_GROUPS },
}
