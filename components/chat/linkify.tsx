import type { ReactNode } from "react"

import { telHref } from "@/lib/interpolate"

// Port of JW features/chat/linkify.tsx (live chat plan C2): turns contact
// details inside a staff or AI message into tappable links. Emails open the
// mail app, phone numbers dial, a number labelled "WhatsApp" opens a WhatsApp
// chat, and the configured quote href opens the quote form in the same tab.
// Hrefs are built from the matched digits/address only (or are the configured
// href itself), so no message text ever lands in an href. Other URLs are
// never linked.

const EMAIL = String.raw`[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`
// Spaces/tabs only, never a newline: a number must not run across lines.
const PHONE = String.raw`\+?\(?\d[\d \t().-]{6,}\d`
// The quote href counts only on its own, not inside a longer URL or path.
const PATH_BEFORE = String.raw`(?<![\w/#.:-])`
const PATH_AFTER = String.raw`(?![\w/#-])`
const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g
const WHATSAPP = /whats\s*app/i

const MIN_DIGITS = 9
const MAX_DIGITS = 15
/** How far before a number a "WhatsApp" label may sit, on the same line. */
const LABEL_REACH = 40

const linkClass =
  "underline underline-offset-2 decoration-current/50 hover:decoration-current"

function tokens(quoteHref: string) {
  const quote = quoteHref
    ? `|(${PATH_BEFORE}${quoteHref.replace(REGEX_SPECIAL, "\\$&")}${PATH_AFTER})`
    : ""
  return new RegExp(`(${EMAIL})|(${PHONE})${quote}`, "g")
}

// "WhatsApp" earlier on the same line, within a short label distance.
function isWhatsApp(text: string, index: number) {
  const lineStart = text.lastIndexOf("\n", index - 1) + 1
  const before = text.slice(Math.max(lineStart, index - LABEL_REACH), index)
  return WHATSAPP.test(before)
}

export function linkify(
  text: string,
  { quoteHref }: { quoteHref: string }
): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(tokens(quoteHref))) {
    const [whole, email, phone, quote] = match
    const start = match.index
    let href: string | null = null
    let label = whole
    let external = false

    if (email) {
      href = `mailto:${email}`
    } else if (phone) {
      // Trailing spaces/punctuation are not part of the number.
      label = phone.replace(/[\s.(-]+$/, "")
      const digits = label.replace(/\D/g, "")
      if (digits.length >= MIN_DIGITS && digits.length <= MAX_DIGITS) {
        const tel = telHref(label)
        if (isWhatsApp(text, start)) {
          // wa.me takes the international number without "+".
          href = `https://wa.me/${tel.replace(/^tel:\+?/, "")}`
          external = true
        } else {
          href = tel
        }
      }
    } else if (quote) {
      href = quoteHref
    }

    if (!href) continue
    if (start > last) out.push(text.slice(last, start))
    out.push(
      <a
        key={start}
        href={href}
        className={linkClass}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {label}
      </a>
    )
    last = start + label.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
