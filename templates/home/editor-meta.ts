import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"

/** Editor labels for the home page (template "home"). */
export const homeEditorMeta: EditorMeta = {
  fields: {
    hero: {
      label: "Hero",
      help: "The full-screen banner at the top of the home page.",
    },
    "hero.eyebrow": { label: "Eyebrow", help: "Small line above the heading." },
    "hero.heading": { label: "Heading" },
    "hero.tagline": { label: "Tagline" },
    "hero.subheading": { label: "Introduction", rows: 3 },
    "hero.backgroundImage": { label: "Background image" },
    "hero.primaryCta": { label: "Primary button" },
    "hero.secondaryCta": {
      label: "Secondary button",
      help: "{phone24h} and {phone24hHref} are replaced with the 24-hour number from Settings › Contact.",
    },
    "hero.stats": { label: "Stats", itemName: "Stat", itemLabel: "label" },
    "hero.stats[].value": {
      label: "Value",
      help: "Text shown, e.g. 24/7. With a count-up number it is set from the number and suffix.",
      composeFrom: ["count", "suffix"],
    },
    "hero.stats[].label": { label: "Label" },
    "hero.stats[].count": {
      label: "Count-up number",
      help: "Optional. The value animates from 0 to this number.",
    },
    "hero.stats[].suffix": {
      label: "Suffix after the number",
      help: "Optional, e.g. +.",
    },
    services: {
      label: "Services section",
      help: "The heading above the service cards.",
    },
    team: {
      label: "Team section",
      help: "The heading above the team photos.",
    },
    blog: {
      label: "Blog section",
      help: "The latest articles near the end of the page.",
    },
    "blog.cta": { label: "Button" },
    "blog.count": {
      label: "Posts shown",
      help: "How many recent articles appear on the home page.",
    },
  },
  groups: {
    hero: [
      {
        title: "Text",
        description: "The words over the banner photo.",
        fields: ["eyebrow", "heading", "tagline", "subheading"],
      },
      { title: "Background", fields: ["backgroundImage"] },
      {
        title: "Buttons",
        description: "The two calls to action under the text.",
        fields: ["primaryCta", "secondaryCta"],
      },
      {
        title: "Stats",
        description: "The figures along the bottom of the banner.",
        fields: ["stats"],
      },
    ],
  },
}
