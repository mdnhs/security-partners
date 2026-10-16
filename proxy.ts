import { getSessionCookie } from "better-auth/cookies"
import { type NextRequest, NextResponse } from "next/server"

import { isAdminAuthPath } from "@/lib/auth/redirect"

/**
 * Admin gate, optimistic only: checks that a session cookie is present (no
 * DB). The real checks are requireSession() in the panel layout and the Hono
 * middleware. Matches /admin only: /api is excluded so upload bodies are never
 * buffered here (X-Robots-Tag for /api is set by Hono).
 */
export function proxy(request: NextRequest) {
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

export const config = {
  matcher: ["/admin/:path*"],
}
