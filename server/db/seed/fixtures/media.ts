import "server-only"

import type { MediaRef } from "@/lib/schemas/common"

/**
 * Every public/images file that content references. Seeded as media rows
 * with driver "static" and key = URL path, so rendered src stays identical.
 * Design-only assets (check.svg, ellipse.svg, map-pin.svg, icon-phone.svg,
 * map tiles) stay in public/ and are not in the library.
 */
export const MEDIA = [
  { key: "/images/logo.png", alt: "Security Partners Ltd." },
  { key: "/images/hero.jpg", alt: "" },
  {
    key: "/images/about.png",
    alt: "Security Partners officer reviewing paperwork",
  },
  { key: "/images/banner.png", alt: "" },
  { key: "/images/team-temp.jpg", alt: "" },
  { key: "/images/service-alarm.png", alt: "" },
  { key: "/images/service-patrols.png", alt: "" },
  { key: "/images/service-lockups.png", alt: "" },
  { key: "/images/service-static.png", alt: "" },
  { key: "/images/service-commercial.png", alt: "" },
  { key: "/images/service-event.png", alt: "" },
  { key: "/images/client-dinn-ri.png", alt: "Dinn Rí" },
  { key: "/images/client-langton.png", alt: "Langton House Hotel" },
  { key: "/images/client-hayes.png", alt: "Hayes Hotel" },
  { key: "/images/client-martin-reddin.png", alt: "Martin Reddin" },
  { key: "/images/client-killeen.png", alt: "Killeen Civil Engineering" },
  { key: "/images/client-greenfield.png", alt: "Greenfield" },
  { key: "/images/client-telfords.png", alt: "Telfords" },
  { key: "/images/client-laois-hire.png", alt: "Laois Hire" },
  { key: "/images/group-mjs-eco.png", alt: "MJS Eco" },
  { key: "/images/group-cleaning-partners.png", alt: "Cleaning Partners" },
  { key: "/images/icon-shield.svg", alt: "" },
  { key: "/images/icon-clock.svg", alt: "" },
  { key: "/images/icon-users.svg", alt: "" },
  { key: "/images/icon-map.svg", alt: "" },
  { key: "/images/icon-award.svg", alt: "" },
  { key: "/images/icon-chart.svg", alt: "" },
  { key: "/images/icon-file.svg", alt: "" },
  { key: "/images/clock.svg", alt: "" },
  { key: "/images/phone.svg", alt: "" },
  { key: "/images/pin.svg", alt: "" },
  { key: "/images/mail.svg", alt: "" },
] as const

export type MediaKey = (typeof MEDIA)[number]["key"]

/** Fixtures reference media by key; the seed runner maps keys to row ids. */
export type MediaLookup = (key: MediaKey) => MediaRef

/**
 * Deterministic ids (valid uuid v7 shape) for unit tests and for the
 * fixture-backed site sources: "00000000-0000-7000-8000-000000000001", …
 */
export function fixtureMediaId(key: MediaKey): string {
  const index = MEDIA.findIndex((m) => m.key === key)
  if (index < 0) throw new Error(`Unknown media key ${key}`)
  return `00000000-0000-7000-8000-${String(index + 1).padStart(12, "0")}`
}

export const fixtureMediaLookup: MediaLookup = (key) => ({
  mediaId: fixtureMediaId(key),
})

/** Reverse of fixtureMediaId. */
export function fixtureMediaKey(id: string): MediaKey {
  const index = Number(id.slice(-12)) - 1
  const entry = MEDIA[index]
  if (!entry || fixtureMediaId(entry.key) !== id)
    throw new Error(`Not a fixture media id: ${id}`)
  return entry.key
}
