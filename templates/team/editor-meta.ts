import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"

import { PAGE_HERO_GROUPS } from "../shared/editor-groups"

/** Editor labels for the Team page (template "team"). People are edited under Team. */
export const teamEditorMeta: EditorMeta = {
  fields: {
    sections: {
      label: "Page sections",
      widget: "sections",
      help: "Show, hide and reorder the sections below the hero. Their content is edited where it lives; hiding a section keeps it.",
      options: [
        { value: "team", label: "Leadership" },
        { value: "officers", label: "Officers" },
        { value: "enquireBanner", label: "Enquiry banner" },
      ],
    },
    hero: { label: "Page hero", help: "Banner at the top of the page." },
    "hero.image": { label: "Banner image" },
    "hero.title": { label: "Title" },
    "hero.description": { label: "Introduction" },
    leadership: {
      label: "Leadership section",
      help: "The heading above the management team.",
    },
    "leadership.photoPlaceholder": {
      label: "Photo placeholder",
      help: "Shown behind every team photo (also on the home page).",
    },
    officers: {
      label: "Officers section",
      help: "What makes the officers good at the job.",
    },
    "officers.qualities": {
      label: "Qualities",
      itemName: "Quality",
      itemNamePlural: "Qualities",
      itemLabel: "title",
    },
    "officers.qualities[].icon": { label: "Icon", aspect: "square" },
  },
  groups: { hero: PAGE_HERO_GROUPS },
}
