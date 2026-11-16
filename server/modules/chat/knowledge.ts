import "server-only"

import { CHAT_QUOTE_HREF } from "@/lib/chat/text"
import { getDb } from "@/server/db/client"
import { oneLine } from "@/server/modules/ai/prompt"
import { flattenText } from "@/server/modules/ai/tool-data"
import { findPageByKey } from "@/server/modules/pages/repo"
import { listServiceRows } from "@/server/modules/services/repo"
import { readPublishedSettings } from "@/server/modules/settings/service"

export const KNOWLEDGE_MAX = 8000
const ELLIPSIS = "…"
const TTL_MS = 5 * 60_000

/** Fixed pages in knowledge order, with their section headings. */
const PAGES = [
  ["home", "Home"],
  ["services", "Services page"],
  ["about", "About"],
  ["team", "Team"],
  ["contact", "Contact page"],
  ["careers", "Careers"],
] as const

// A cache only: a cold process just rebuilds the text.
let cached: { at: number; text: string } | null = null

export function clearKnowledgeCache() {
  cached = null
}

/**
 * Text on one line with no leading `#`, so none of it can open a new
 * `##` heading (JW knowledge.ts).
 */
const clean = (text: string, max = KNOWLEDGE_MAX) =>
  oneLine(text, max).replace(/^[#\s]+/, "")

type Section = { title: string; text: string }

/** Contact first, then sections in order until the cap (JW knowledge.ts:26-64). */
function compose(contactLines: string[], sections: Section[]): string {
  let out = `## Contact\n${contactLines.join("\n")}`
  for (const s of sections) {
    const title = clean(s.title, 200)
    const text = clean(s.text)
    if (!title && !text) continue
    const head = `\n\n## ${title}\n`
    if (out.length + head.length + text.length <= KNOWLEDGE_MAX) {
      out += head + text
      continue
    }
    // First section that does not fit: cut at a sentence, drop the rest.
    const room = KNOWLEDGE_MAX - out.length - head.length - ELLIPSIS.length
    if (room > 20) {
      const slice = text.slice(0, room)
      const cut = slice.lastIndexOf(". ")
      const body = (cut > 0 ? slice.slice(0, cut + 1) : slice).trimEnd()
      out += head + body + ELLIPSIS
    }
    break
  }
  return out
}

/**
 * What the chat bot may answer from, built from published values only:
 * contact details, services, why choose us and the fixed pages. At most
 * KNOWLEDGE_MAX chars; cached in this process for 5 minutes.
 */
export async function buildKnowledge(): Promise<string> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.text
  const db = getDb()
  const [site, contact, whyChooseUs, serviceRows, pageRows] = await Promise.all([
    readPublishedSettings("site", db),
    readPublishedSettings("contact", db),
    readPublishedSettings("sections.whyChooseUs", db),
    listServiceRows(db),
    Promise.all(PAGES.map(([key]) => findPageByKey(db, key))),
  ])

  const line = (label: string, value: string | undefined, max = 300) => {
    const v = clean(value ?? "", max)
    return v ? `${label}: ${v}` : ""
  }
  const contactLines = [
    line("Company", site?.name, 200),
    line("Phone", contact?.office, 100),
    line("Operations mobile", contact?.operationsMobile, 100),
    line("24 hour line", contact?.phone24h, 100),
    line("Email", contact?.email, 200),
    line("Operations email", contact?.operationsEmail, 200),
    line("Hours", contact?.hours, 400),
    line(
      "Address",
      [contact?.addressLine1, contact?.addressLine2].filter(Boolean).join(", ")
    ),
    line("Quote form", CHAT_QUOTE_HREF, 200),
  ].filter(Boolean)

  const sections: Section[] = []
  const services = serviceRows
    .filter((row) => row.published)
    .map((row) => {
      const text = flattenText(row.published)
      return text ? `${clean(row.published!.title, 200)}: ${text}` : ""
    })
    .filter(Boolean)
  if (services.length)
    sections.push({ title: "Services", text: services.join(" ") })
  if (whyChooseUs)
    sections.push({ title: "Why choose us", text: flattenText(whyChooseUs) })
  PAGES.forEach(([, title], i) => {
    const page = pageRows[i]
    if (page?.published)
      sections.push({ title, text: flattenText(page.published) })
  })

  const text = compose(
    contactLines,
    sections.filter((s) => s.text)
  )
  cached = { at: Date.now(), text }
  return text
}
