import { z } from "zod"

import { aboutTemplate } from "./about/schema"
import { blogTemplate } from "./blog/schema"
import { contactTemplate } from "./contact/schema"
import { homeTemplate } from "./home/schema"
import { legalTemplate } from "./legal/schema"
import { servicesTemplate } from "./services/schema"
import { teamTemplate } from "./team/schema"

/** Fixed templates (spec §5.2): schema validates a page's draft/published data. */
export const templates = {
  home: { schema: homeTemplate, label: "Home" },
  about: { schema: aboutTemplate, label: "About" },
  services: { schema: servicesTemplate, label: "Services" },
  team: { schema: teamTemplate, label: "Team" },
  blog: { schema: blogTemplate, label: "Blog" },
  contact: { schema: contactTemplate, label: "Contact" },
  legal: { schema: legalTemplate, label: "Legal page" },
} as const

export type TemplateName = keyof typeof templates
export type TemplateData<T extends TemplateName> = z.infer<
  (typeof templates)[T]["schema"]
>

/** Every page row: key → template. Seeded; never created or deleted in the admin. */
export const PAGES = {
  home: "home",
  about: "about",
  services: "services",
  team: "team",
  blog: "blog",
  contact: "contact",
  privacy: "legal",
  terms: "legal",
} as const satisfies Record<string, TemplateName>

export type PageKey = keyof typeof PAGES
export const PAGE_KEYS = Object.keys(PAGES) as PageKey[]
export type PageData<K extends PageKey> = TemplateData<(typeof PAGES)[K]>

/** Public URL of each page. */
export const PAGE_PATHS = {
  home: "/",
  about: "/about",
  services: "/services",
  team: "/team",
  blog: "/blog",
  contact: "/contact",
  privacy: "/privacy",
  terms: "/terms",
} as const satisfies Record<PageKey, string>

export function isPageKey(value: string): value is PageKey {
  return Object.hasOwn(PAGES, value)
}

export function templateSchemaFor(key: PageKey) {
  return templates[PAGES[key]].schema
}
