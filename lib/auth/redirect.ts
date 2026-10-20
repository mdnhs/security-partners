/** Admin pages reachable without a session (proxy.ts lets them through). */
export const ADMIN_AUTH_PATHS = [
  "/admin/sign-in",
  "/admin/two-factor",
  "/admin/set-password",
  "/admin/reset-password",
  "/admin/forgot-password",
] as const

export const ADMIN_HOME = "/admin"

export function isAdminAuthPath(pathname: string): boolean {
  return ADMIN_AUTH_PATHS.some(
    (path) => pathname === path || pathname === `${path}/`
  )
}

/**
 * Where to go after signing in. Only same-site admin paths are allowed (no
 * open redirects via `?next=https://evil` or `//evil`), and never back to an
 * auth page.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return ADMIN_HOME
  if (next.includes("\\")) return ADMIN_HOME
  let url: URL
  try {
    url = new URL(next, "http://local.invalid")
  } catch {
    return ADMIN_HOME
  }
  if (url.origin !== "http://local.invalid") return ADMIN_HOME
  if (url.pathname !== ADMIN_HOME && !url.pathname.startsWith(`${ADMIN_HOME}/`))
    return ADMIN_HOME
  if (isAdminAuthPath(url.pathname)) return ADMIN_HOME
  return `${url.pathname}${url.search}${url.hash}`
}
