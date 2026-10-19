"use client"

import { Copy } from "lucide-react"
import Link from "next/link"
import { type JSX, type ReactNode, useMemo } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

/**
 * A safe Markdown subset for assistant replies (MK parity C9): paragraphs,
 * headings (drawn as bold paragraphs, so a reply never adds to the page
 * outline), lists, quotes, tables, rules, fenced and inline code, bold,
 * italic and links. Everything else, raw HTML included, stays text: React
 * escapes it, and nothing here sets innerHTML.
 */
export type MdBlock =
  | { kind: "p"; text: string }
  | { kind: "h"; level: number; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[]; start: number }
  | { kind: "code"; lang: string; text: string }
  | { kind: "quote"; paragraphs: string[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "hr" }

const FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([^\s`]*)/
// Every pattern here runs in linear time on one line, whatever a reply
// holds (C9 review M4): no lazy groups before optional tails, and bounded
// link parts.
const HEADING = /^\s{0,3}(#{1,6})\s+(.*)$/
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/
const ITEM = /^\s*([-*+]|\d{1,9}[.)])\s+(.*)$/
const QUOTE = /^\s{0,3}>\s?(.*)$/
const TABLE_RULE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/

/** A label like "ts" or "c++"; anything stranger is just "Code". */
const langOf = (raw: string) => (/^[\w+#.-]{1,20}$/.test(raw) ? raw : "")

/** A heading's text without its optional closing "#"s ("## Title ##"). */
function headingText(raw: string): string {
  const text = raw.trimEnd()
  let end = text.length
  while (end > 0 && text[end - 1] === "#") end--
  if (end === text.length) return text
  return end === 0 || /\s/.test(text[end - 1]!)
    ? text.slice(0, end).trimEnd()
    : text
}

function cells(line: string): string[] {
  let row = line.trim()
  if (row.startsWith("|")) row = row.slice(1)
  if (row.endsWith("|") && !row.endsWith("\\|")) row = row.slice(0, -1)
  return row.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"))
}

function isTableStart(lines: string[], i: number) {
  const head = lines[i]!
  const rule = lines[i + 1]
  if (!head.includes("|") || rule === undefined || !rule.includes("-"))
    return false
  if (!TABLE_RULE.test(rule)) return false
  return cells(head).length === cells(rule).length
}

export function parseBlocks(source: string): MdBlock[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n")
  const blocks: MdBlock[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") })
    para = []
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const fence = FENCE.exec(line)
    if (fence) {
      flush()
      const marker = fence[1]!
      const code: string[] = []
      // An unclosed fence (a reply still streaming) runs to the end.
      for (i++; i < lines.length && !lines[i]!.trim().startsWith(marker); i++)
        code.push(lines[i]!)
      blocks.push({
        kind: "code",
        lang: langOf(fence[2]!),
        text: code.join("\n"),
      })
      continue
    }
    const heading = HEADING.exec(line)
    if (heading) {
      flush()
      blocks.push({
        kind: "h",
        level: heading[1]!.length,
        text: headingText(heading[2]!),
      })
      continue
    }
    if (RULE.test(line)) {
      flush()
      blocks.push({ kind: "hr" })
      continue
    }
    if (isTableStart(lines, i)) {
      flush()
      const head = cells(line)
      const rows: string[][] = []
      for (i += 2; i < lines.length && lines[i]!.includes("|"); i++) {
        if (!lines[i]!.trim()) break
        const row = cells(lines[i]!).slice(0, head.length)
        while (row.length < head.length) row.push("")
        rows.push(row)
      }
      i--
      blocks.push({ kind: "table", head, rows })
      continue
    }
    const quote = QUOTE.exec(line)
    if (quote) {
      flush()
      const paragraphs: string[] = []
      let current: string[] = []
      for (; i < lines.length; i++) {
        const q = QUOTE.exec(lines[i]!)
        if (!q) break
        if (q[1]!.trim()) current.push(q[1]!.trim())
        else if (current.length) {
          paragraphs.push(current.join(" "))
          current = []
        }
      }
      i--
      if (current.length) paragraphs.push(current.join(" "))
      blocks.push({ kind: "quote", paragraphs })
      continue
    }
    const item = ITEM.exec(line)
    if (item) {
      flush()
      const ordered = /\d/.test(item[1]!)
      const last = blocks.at(-1)
      if (last && last.kind === (ordered ? "ol" : "ul"))
        (last as { items: string[] }).items.push(item[2]!)
      else if (ordered)
        blocks.push({
          kind: "ol",
          items: [item[2]!],
          start: Number.parseInt(item[1]!, 10) || 1,
        })
      else blocks.push({ kind: "ul", items: [item[2]!] })
      continue
    }
    if (!line.trim()) flush()
    else para.push(line.trim())
  }
  flush()
  return blocks
}

/**
 * Where a link in a reply may go: https, a plain `mailto:` (no query, so no
 * prefilled subject or body), or a site path. Never javascript:, data:,
 * http:, protocol-relative (`//host`, `/\host`) or the API: a GET there can
 * download data (an export), and a reply's links can be steered by text the
 * model read (prompt injection). null = show the link as text.
 */
export function safeHref(raw: string): string | null {
  if (/[\u0000-\u001f\u007f\s]/.test(raw)) return null
  if (raw.startsWith("/")) {
    if (/^\/[/\\]/.test(raw)) return null
    // Resolve dot segments and decode before looking at the path.
    let path: string
    try {
      path = decodeURIComponent(new URL(raw, "https://admin.invalid").pathname)
    } catch {
      return null
    }
    return /^\/api(\/|$)/i.test(path) ? null : raw
  }
  try {
    const url = new URL(raw)
    if (url.protocol === "mailto:")
      return url.search || raw.includes("?") ? null : url.href
    return url.protocol === "https:" ? url.href : null
  } catch {
    return null
  }
}

const INLINE =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[[^\]\n]{1,200}\]\([^)\s]{1,2000}\))/g
const LINK_PARTS = /^\[([^\]\n]{1,200})\]\(([^)\s]{1,2000})\)$/
const LINK =
  "font-medium text-primary underline underline-offset-2 outline-none focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50"

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let key = 0
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const t = m[0]
    if (m[1])
      out.push(
        <code
          key={key++}
          className="rounded-md border bg-card px-1 py-px font-mono text-[0.85em]"
        >
          {t.slice(1, -1)}
        </code>
      )
    else if (m[2])
      out.push(
        <strong key={key++} className="font-semibold">
          {inline(t.slice(2, -2))}
        </strong>
      )
    else if (m[3]) out.push(<em key={key++}>{inline(t.slice(1, -1))}</em>)
    else {
      const [, label, href] = LINK_PARTS.exec(t)!
      const safe = safeHref(href!)
      // Where an external link goes, visible before the click (a reply's
      // links can be steered by text the model read; C9 review M7).
      const host = safe?.startsWith("https:") ? new URL(safe).hostname : null
      out.push(
        !safe ? (
          `${label} (${href})`
        ) : safe.startsWith("/") ? (
          // Same site: client navigation keeps the open panel and chat.
          <Link key={key++} href={safe} className={LINK}>
            {label}
          </Link>
        ) : (
          <a
            key={key++}
            href={safe}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={LINK}
          >
            {label}
            {host ? (
              <span className="font-normal text-muted-foreground">
                {" "}
                ({host})
              </span>
            ) : null}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )
      )
    }
    last = m.index + t.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function CodeBlock({ lang, text }: { lang: string; text: string }) {
  const label = lang || "Code"
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Copied")
    } catch {
      toast.error("Could not copy to the clipboard")
    }
  }
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b py-1 pr-1 pl-3">
        <span className="font-mono text-xs text-muted-foreground">{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="pointer-coarse:h-11"
          aria-label={`Copy ${lang ? `${lang} ` : ""}code`}
          onClick={() => void copy()}
        >
          <Copy data-icon="inline-start" />
          Copy
        </Button>
      </div>
      <pre
        // Scrolls sideways: reachable by keyboard (WCAG 2.1.1).
        tabIndex={0}
        role="region"
        aria-label={lang ? `${lang} code` : "Code"}
        className="overflow-x-auto p-3 font-mono text-[0.8125rem] leading-relaxed outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <code>{text}</code>
      </pre>
    </div>
  )
}

function Table({ block }: { block: Extract<MdBlock, { kind: "table" }> }) {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Table"
      className="max-w-full overflow-x-auto rounded-xl border bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <table className="w-full border-collapse text-[0.8125rem]">
        <thead className="bg-muted/60">
          <tr>
            {block.head.map((cell, i) => (
              <th
                key={i}
                scope="col"
                className="px-3 py-2 text-left font-semibold"
              >
                {inline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, r) => (
            <tr key={r} className="border-t align-top">
              {row.map((cell, i) => (
                <td key={i} className="px-3 py-2">
                  {inline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const HEADING_CLASS = [
  "",
  "mt-1 text-[1.0625rem] font-semibold tracking-tight",
  "mt-1 text-base font-semibold tracking-tight",
]

/** A reply as safe Markdown (see the module comment). */
export function Markdown({ text }: { text: string }): JSX.Element {
  // Parsed again only when this reply's text changes, not on every
  // re-render of the conversation.
  const blocks = useMemo(() => parseBlocks(text), [text])
  return (
    <div className="flex min-w-0 flex-col gap-3 leading-relaxed wrap-break-word">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "h":
            return (
              <p
                key={i}
                className={HEADING_CLASS[block.level] ?? "font-semibold"}
              >
                {inline(block.text)}
              </p>
            )
          case "code":
            return <CodeBlock key={i} lang={block.lang} text={block.text} />
          case "table":
            return <Table key={i} block={block} />
          case "hr":
            return <hr key={i} className="my-1 border-border" />
          case "quote":
            return (
              <blockquote
                key={i}
                className="flex flex-col gap-2 border-l-2 border-primary/60 pl-3 text-muted-foreground"
              >
                {block.paragraphs.map((p, j) => (
                  <p key={j}>{inline(p)}</p>
                ))}
              </blockquote>
            )
          case "p":
            return <p key={i}>{inline(block.text)}</p>
          case "ul":
            return (
              <ul
                key={i}
                className="flex list-disc flex-col gap-1 pl-5 marker:text-primary"
              >
                {block.items.map((item, j) => (
                  <li key={j}>{inline(item)}</li>
                ))}
              </ul>
            )
          case "ol":
            return (
              <ol
                key={i}
                start={block.start === 1 ? undefined : block.start}
                className="flex list-decimal flex-col gap-1 pl-5 marker:text-muted-foreground"
              >
                {block.items.map((item, j) => (
                  <li key={j}>{inline(item)}</li>
                ))}
              </ol>
            )
        }
      })}
    </div>
  )
}
