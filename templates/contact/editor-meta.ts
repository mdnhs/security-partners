import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"

/** Editor labels for the Contact page (template "contact"). The form and map are in Settings › Shared sections. */
export const contactEditorMeta: EditorMeta = {
  fields: {
    hero: { label: "Page hero", help: "Banner at the top of the page." },
    "hero.image": { label: "Banner image" },
    "hero.crumb": { label: "Breadcrumb label" },
    "hero.title": { label: "Title" },
    "hero.description": { label: "Introduction" },
    departments: { label: "Departments section" },
    "departments.items": {
      label: "Departments",
      itemName: "Department",
      itemLabel: "title",
    },
    "departments.items[].icon": { label: "Icon" },
    "departments.items[].name": { label: "Contact person" },
    "departments.items[].role": { label: "Their role" },
    "departments.items[].lines": {
      label: "Contact lines",
      itemName: "Line",
      itemLabel: "text",
    },
    "departments.items[].lines[].text": {
      label: "Text",
      help: "Placeholders such as {office} are filled from Settings › Contact.",
    },
    "departments.items[].lines[].href": {
      label: "Link",
      help: "tel:, mailto: or a placeholder such as {officeHref}.",
    },
  },
}
