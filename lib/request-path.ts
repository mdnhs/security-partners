/**
 * Request header proxy.ts sets on public page requests: the page's path and
 * query. Server components have no pathname API; the preview guard
 * (server/modules/preview/guard.ts) uses it to send an ended preview back to
 * the same page. Always overwritten by the proxy, so a client-sent value
 * never reaches a page.
 */
export const REQUEST_PATH_HEADER = "x-sp-path"
