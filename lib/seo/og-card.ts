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

export function ogCard(input: OgCardInput): OgCard {
  const chars = [...input.title.replace(/\s+/g, " ").trim()]
  const title =
    chars.length > MAX_TITLE
      ? `${chars
          .slice(0, MAX_TITLE - 1)
          .join("")
          .trimEnd()}…`
      : chars.join("")
  const length = [...title].length
  return {
    eyebrow: EYEBROW[input.kind] ?? input.siteName,
    title,
    titleSize: length > 70 ? 56 : length > 36 ? 68 : 80,
    siteName: input.siteName,
    host: new URL(input.origin).host,
  }
}
