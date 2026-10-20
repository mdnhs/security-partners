import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"

/** Editor hints for a service (card on /services + its own page). */
export const serviceEditorMeta: EditorMeta = {
  fields: {
    title: { label: "Name" },
    description: { label: "Card text", help: "Shown on the service card." },
    icon: { label: "Card icon", aspect: "square" },
    heroImage: { label: "Page banner image" },
    image: { label: "Page image" },
    imageAlt: { label: "Page image description (alt text)" },
    detail: {
      label: "Service page",
      section: true,
      help: "The text of the service's own page.",
    },
    "detail.intro": { label: "Introduction", widget: "textarea" },
    "detail.heading": { label: "Heading" },
    "detail.overview": { label: "Overview" },
    "detail.included": { label: "What's included", itemName: "Item" },
    "detail.callout": { label: "Callout", widget: "textarea" },
  },
  groups: {
    "": [
      {
        title: "Service card",
        description: "How the service appears in the list on /services.",
        fields: ["title", "description", "icon"],
      },
      {
        title: "Page images",
        description: "The banner and the photo on the service's own page.",
        fields: ["heroImage", "image", "imageAlt"],
      },
    ],
  },
}
