import "server-only"

import type { CategoryInput } from "@/lib/schemas/content/category"

/**
 * Display order = sortOrder. The first five are the blog filter bar; the
 * last two only label articles (ruling: showInFilter).
 */
export const CATEGORIES: CategoryInput[] = [
  { slug: "company-news", name: "Company News", showInFilter: true },
  { slug: "mobile-patrols", name: "Mobile Patrols", showInFilter: true },
  { slug: "event-security", name: "Event Security", showInFilter: true },
  { slug: "retail-security", name: "Retail Security", showInFilter: true },
  { slug: "alarm-response", name: "Alarm Response", showInFilter: true },
  { slug: "key-holding", name: "Key Holding", showInFilter: false },
  { slug: "open-up-lock-up", name: "Open Up & Lock Up", showInFilter: false },
]
