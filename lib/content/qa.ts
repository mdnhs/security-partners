// Content QA (MK parity D3.5): placeholder text and unfinished legal pages
// the dashboard lists before launch. Pure and isomorphic. Every value is
// plain text: findings quote a clipped match, never markup.

import { PAGE_LABELS } from "@/lib/admin/page-labels"
import {
  isEditableSettingsKey,
  SETTINGS_ENTRIES,
} from "@/lib/admin/settings-keys"

export type QaRuleId =
  "placeholder-contact" | "placeholder-copy" | "legal-unpublished"

export type QaFinding = {
  rule: QaRuleId
  /** The record's admin name ("Contact details", "Terms of use", a service title). */
  label: string
  /** Its editor. */
  href: string
  message: string
}

/** Settings whose strings are contact details. */
const CONTACT_KEYS = new Set(["contact", "footer"])
const CONTACT = /\[(email|phone)\]|example\.(com|ie)|\b0{3,}\b/i
const COPY = /lorem ipsum|\bTODO\b|\bTBC\b|\[[^\]]{1,40}\]/i
/** Media and row ids are not copy ("00000000-0000-7000-…" has zero runs). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LEGAL = ["privacy", "terms"] as const
const QUOTE_MAX = 40
const MESSAGE_MAX = 160
/** Depth guard for hostile or cyclic data. */
const MAX_DEPTH = 32

/** Every string inside `value` (objects, arrays), in document order. */
function* strings(value: unknown, depth = 0): Generator<string> {
  if (depth > MAX_DEPTH) return
  if (typeof value === "string") {
    yield value
  } else if (Array.isArray(value)) {
    for (const item of value) yield* strings(item, depth + 1)
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) yield* strings(item, depth + 1)
  }
}

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text

/** `Found "[phone]"` (and N more), within MESSAGE_MAX characters. */
function message(lead: string, matches: string[]): string {
  const quoted = clip(matches[0]!.replace(/\s+/g, " ").trim(), QUOTE_MAX)
  const more = matches.length > 1 ? ` and ${matches.length - 1} more` : ""
  return clip(`${lead}: "${quoted}"${more}.`, MESSAGE_MAX)
}

type Matches = { contact: string[]; copy: string[] }

function scan(data: unknown, contactRules: boolean): Matches {
  const found: Matches = { contact: [], copy: [] }
  for (const text of strings(data)) {
    if (UUID.test(text.trim())) continue
    const contact = contactRules ? CONTACT.exec(text) : null
    // A contact placeholder is reported once, as such (not also as copy).
    if (contact) {
      found.contact.push(contact[0])
      continue
    }
    const copy = COPY.exec(text)
    if (copy) found.copy.push(copy[0])
  }
  return found
}

function pageLabel(key: string): string {
  return Object.hasOwn(PAGE_LABELS, key)
    ? PAGE_LABELS[key as keyof typeof PAGE_LABELS]
    : key
}

/**
 * QA findings, in order: settings (contact then copy), pages, builder
 * pages (/p/<slug>), services, then the legal pages. One finding per
 * record and rule. Callers pass only what the viewer may read: with no
 * pages at all (no page:read) the legal rule is skipped rather than
 * reporting both pages missing.
 */
export function scanContent(input: {
  settings: Record<string, unknown>
  pages: {
    key: string
    data: unknown
    published: boolean
    updatedSinceSeed: boolean
  }[]
  services: { id: string; title: string; data: unknown }[]
  /** Page-builder pages (page:read), edited at /admin/pages/custom/<id>. */
  builderPages?: { id: string; title: string; data: unknown }[]
}): QaFinding[] {
  const findings: QaFinding[] = []
  const add = (
    record: { label: string; href: string },
    found: Matches
  ): void => {
    if (found.contact.length)
      findings.push({
        rule: "placeholder-contact",
        ...record,
        message: message("Placeholder contact details", found.contact),
      })
    if (found.copy.length)
      findings.push({
        rule: "placeholder-copy",
        ...record,
        message: message("Placeholder text", found.copy),
      })
  }

  for (const [key, value] of Object.entries(input.settings)) {
    add(
      {
        label: isEditableSettingsKey(key) ? SETTINGS_ENTRIES[key].label : key,
        href: `/admin/settings/${key}`,
      },
      scan(value, CONTACT_KEYS.has(key))
    )
  }
  for (const page of input.pages)
    add(
      { label: pageLabel(page.key), href: `/admin/pages/${page.key}` },
      scan(page.data, false)
    )
  for (const page of input.builderPages ?? [])
    add(
      {
        label: page.title.trim() || "Untitled page",
        href: `/admin/pages/custom/${page.id}`,
      },
      scan(page.data, false)
    )
  for (const service of input.services)
    add(
      {
        label: service.title.trim() || "Untitled service",
        href: `/admin/services/${service.id}`,
      },
      scan(service.data, false)
    )

  for (const key of input.pages.length ? LEGAL : []) {
    const page = input.pages.find((p) => p.key === key)
    if (page?.published && page.updatedSinceSeed) continue
    findings.push({
      rule: "legal-unpublished",
      label: pageLabel(key),
      href: `/admin/pages/${key}`,
      message: !page
        ? "This page is missing."
        : !page.published
          ? "Not published yet: the site links to it from every footer."
          : "Still the starter text: have it reviewed, then publish your own.",
    })
  }
  return findings
}
