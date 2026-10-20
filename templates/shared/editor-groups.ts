import type { FieldGroupMeta } from "@/components/admin/schema-form/editor-meta"

/** The page hero of inner pages (pageHero), split into text and banner. */
export const PAGE_HERO_GROUPS: FieldGroupMeta[] = [
  {
    title: "Text",
    description: "The breadcrumb, title and introduction over the banner.",
    fields: ["crumb", "title", "description"],
  },
  { title: "Banner image", fields: ["image"] },
]
