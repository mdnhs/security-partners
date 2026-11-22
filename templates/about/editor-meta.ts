import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"

import { PAGE_HERO_GROUPS } from "../shared/editor-groups"

/** Editor labels for the About page (template "about"). The About section itself is in Settings › Shared sections. */
export const aboutEditorMeta: EditorMeta = {
  fields: {
    sections: {
      label: "Page sections",
      widget: "sections",
      help: "Show, hide and reorder the sections below the hero. Their content is edited where it lives; hiding a section keeps it.",
      options: [
        { value: "about", label: "About" },
        { value: "stats", label: "Stats" },
        { value: "values", label: "Values" },
        { value: "clients", label: "Clients" },
        { value: "enquireBanner", label: "Enquiry banner" },
      ],
    },
    hero: { label: "Page hero", help: "Banner at the top of the page." },
    "hero.image": { label: "Banner image" },
    "hero.title": { label: "Title" },
    "hero.description": { label: "Introduction" },
    stats: {
      label: "Stats",
      itemName: "Stat",
      itemLabel: "label",
      help: "The numbers under the page hero.",
    },
    values: {
      label: "Values section",
      help: "What the company stands for, as icon cards.",
    },
    "values.items": { label: "Values", itemName: "Value", itemLabel: "title" },
    "values.items[].icon": { label: "Icon", aspect: "square" },
  },
  groups: { hero: PAGE_HERO_GROUPS },
}
