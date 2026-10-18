import { getSessionCookie } from "better-auth/cookies"
import {
  type NextFetchEvent,
  type NextRequest,
  NextResponse,
} from "next/server"

import { isAdminAuthPath } from "@/lib/auth/redirect"
import { redirectLocation } from "@/lib/seo/redirects"
import {
  MISSING_PATH,
  resolvePublicPath,
} from "@/server/modules/redirects/resolve"

/** Next's draft-mode cookie (next/dist/server/api-utils COOKIE_NAME_PRERENDER_BYPASS). */
const DRAFT_COOKIE = "__prerender_bypass"

/**
 * Admin gate, optimistic only: checks that a session cookie is present (no
 * DB). The real checks are requireSession() in the panel layout and the
 * Hono middleware. X-Robots-Tag for /api is set by Hono.
 */
export function adminGate(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl
  let response: NextResponse
  if (
    !isAdminAuthPath(pathname) &&
    !getSessionCookie(request, { cookiePrefix: "sp" })
  ) {
    const signIn = new URL("/admin/sign-in", request.url)
    signIn.searchParams.set("next", `${pathname}${search}`)
    response = NextResponse.redirect(signIn)
  } else if (pathname === "/admin/settings") {
    // No settings overview: a real 307 to the first key (the page keeps a
    // redirect for client-side navigation, which never reaches the proxy).
    response = NextResponse.redirect(
      new URL("/admin/settings/site", request.url),
      307
    )
  } else {
    response = NextResponse.next()
  }
  response.headers.set("X-Robots-Tag", "noindex")
  return response
}

/**
 * Public pages (GET/HEAD): real 404 for unknown service/article slugs and
 * the redirects table, decided before the page streams — with Cache
 * Components the status is 200 once streaming starts (Next docs,
 * streaming "Status codes"; phase-08 correction). Fail-open: if anything
 * here throws, the page is served as if the proxy were not there.
 */
export async function publicGate(
  request: NextRequest,
  event: Pick<NextFetchEvent, "waitUntil">
): Promise<NextResponse> {
  if (request.method !== "GET" && request.method !== "HEAD")
    return NextResponse.next()
  try {
    const outcome = await resolvePublicPath(request.nextUrl.pathname, {
      draft: request.cookies.has(DRAFT_COOKIE),
    })
    if (outcome.kind === "missing")
      return NextResponse.rewrite(new URL(MISSING_PATH, request.url))
    if (outcome.kind === "redirect") {
      const location = redirectLocation(outcome.to, new URL(request.url))
      // The hit is written after the response (never delays it).
      event.waitUntil(outcome.recordHit())
      return NextResponse.redirect(location, outcome.code)
    }
  } catch {
    console.error("[proxy] public gate failed; serving the page")
  }
  return NextResponse.next()
}

export async function proxy(
  request: NextRequest,
  event: NextFetchEvent
): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  if (pathname === "/admin" || pathname.startsWith("/admin/"))
    return adminGate(request)
  return publicGate(request, event)
}

export const config = {
  matcher: [
    "/admin/:path*",
    // Public pages only. Never /api: the proxy buffers request bodies and
    // truncates them over 10 MB (uploads). Static files, share cards,
    // sitemap and robots need no lookup. Each exclusion is anchored to a
    // whole segment/file so look-alikes (/apiary, /admin-old) still match
    // and can carry redirects (lib/seo/redirects fromPathProblem allows them).
    "/((?!api(?:/|$)|admin(?:/|$)|_next/|og/|images/|favicon\\.ico$|sitemap\\.xml$|robots\\.txt$).*)",
  ],
}
