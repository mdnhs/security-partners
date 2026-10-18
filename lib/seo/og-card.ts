import type { OgKind } from "./urls"

// Text layout of a generated share card (app/og/[kind]/[slug]/route.tsx).

export type OgCardInput = {
  kind: OgKind
  title: string
  siteName: string
  /** Site origin; its host is printed on the card. */
  origin: string
}

export type OgCard = {
  eyebrow: string
  title: string
  /** Font size in px for the title (long titles get smaller). */
  titleSize: number
  siteName: string
  host: string
}

const EYEBROW: Record<OgKind, string | null> = {
  page: null,
  service: "Service",
  article: "Article",
}
const MAX_TITLE = 110
/** Site name shares a 28px line with the host (footer) or the eyebrow. */
const MAX_SITE_NAME = 40

/** Collapses whitespace and cuts to `max` characters (code points) with "…". */
function clamp(text: string, max: number): string {
  const chars = [...text.replace(/\s+/g, " ").trim()]
  if (chars.length <= max) return chars.join("")
  return `${chars
    .slice(0, max - 1)
    .join("")
    .trimEnd()}…`
}

export function ogCard(input: OgCardInput): OgCard {
  const title = clamp(input.title, MAX_TITLE)
  const siteName = clamp(input.siteName, MAX_SITE_NAME)
  const length = [...title].length
  return {
    eyebrow: EYEBROW[input.kind] ?? siteName,
    title,
    titleSize: length > 70 ? 56 : length > 36 ? 68 : 80,
    siteName,
    host: new URL(input.origin).host,
  }
}
