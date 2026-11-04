import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"

import { PAGE_HERO_GROUPS } from "../shared/editor-groups"

/** Editor labels for the Careers page and the copy its job and apply pages share. */
export const careersEditorMeta: EditorMeta = {
  fields: {
    hero: { label: "Page hero", help: "Banner at the top of /careers." },
    "hero.image": { label: "Banner image" },
    whyJoin: { label: "Why join us", help: "Cards under the hero." },
    openings: {
      label: "Open positions",
      help: "Heading, search and filter labels. {count} becomes the number of roles; {ago} how long ago a role was posted.",
    },
    previous: {
      label: "Previous openings",
      help: "Closed and filled roles. {date} becomes the closing date.",
    },
    process: { label: "Hiring process", help: "Numbered steps." },
    cta: { label: "Closing banner", help: "The talent pool call to action." },
    tags: { label: "Job tags", help: "Words on the small badges of a job." },
    job: {
      label: "Job page",
      help: "Headings and sidebar copy every job page (/careers/<role>) shares.",
    },
    apply: {
      label: "Application form",
      help: "Every label, option and message of /careers/<role>/apply.",
    },
  },
  groups: { hero: PAGE_HERO_GROUPS },
}
