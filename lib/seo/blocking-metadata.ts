// Blocking metadata for public HTML documents only (phase-08 correction,
// revised). Next decides "blocking vs streaming metadata" from the user agent
// alone (`htmlLimitedBots`). Matching every client (`/.*/`) also made RSC
// navigations and prefetches "bot" requests: with Cache Components those are
// then rendered with the real params but cached by the client router as the
// route's param-free shell, so /admin/services/A showed service B (whichever
// link was prefetched last) and /terms showed the home page. proxy.ts marks
// the user agent of public document requests instead, and next.config.ts
// lists only that mark: crawlers, Lighthouse and browsers all get title,
// description, canonical and Open Graph in <head>, and client navigations
// keep Next's normal streaming behaviour.

/** Appended to the user agent of public page documents by proxy.ts. */
export const BLOCKING_METADATA_MARK = "sp-blocking-metadata"

/** next.config.ts `htmlLimitedBots`: only marked requests block on metadata. */
export const HTML_LIMITED_BOTS = new RegExp(BLOCKING_METADATA_MARK)

/**
 * The request headers a public page request is rendered with: a document
 * request gets the mark, an RSC request (client navigation or prefetch,
 * header `RSC: 1`) is left as it is.
 */
export function blockingMetadataHeaders(headers: Headers): Headers | null {
  if (headers.get("rsc") === "1") return null
  const marked = new Headers(headers)
  const ua = headers.get("user-agent")?.trim()
  marked.set(
    "user-agent",
    ua ? `${ua} ${BLOCKING_METADATA_MARK}` : BLOCKING_METADATA_MARK
  )
  return marked
}
