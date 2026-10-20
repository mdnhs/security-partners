import type { Role } from "@/lib/auth/roles"
import { app } from "@/server/api/app"
import { getAuth } from "@/server/auth/auth"

/** Matches BETTER_AUTH_URL in tests/integration/setup.ts. */
export const ORIGIN = "http://localhost:3000"
export const TEST_PASSWORD = "correct-horse-battery-staple"

let counter = 0
const uniqueEmail = (prefix: string) =>
  `${prefix}-${Date.now()}-${++counter}@example.test`

/** Creates a user through Better Auth's server API (no HTTP, no session needed). */
export async function createUser(opts: {
  roles: Role[]
  email?: string
  name?: string
  /** null → passwordless (invited) user */
  password?: string | null
}) {
  const email = opts.email ?? uniqueEmail(opts.roles.join("-") || "user")
  const { user } = await getAuth().api.createUser({
    body: {
      email,
      name: opts.name ?? email.split("@")[0],
      role: opts.roles,
      ...(opts.password === null
        ? {}
        : { password: opts.password ?? TEST_PASSWORD }),
    },
  })
  return user
}

/** `name=value; name2=value2` from a response's Set-Cookie headers (expired cookies skipped). */
export function cookiesFrom(res: Response): string {
  return res.headers
    .getSetCookie()
    .filter((c) => !/max-age=0/i.test(c))
    .map((c) => c.split(";")[0])
    .join("; ")
}

/** Applies a response's Set-Cookie headers to an existing Cookie header (like a browser). */
export function mergeCookies(cookie: string, res: Response): string {
  const jar = new Map<string, string>()
  for (const pair of cookie.split(/;\s*/).filter(Boolean)) {
    const [name, ...value] = pair.split("=")
    jar.set(name, value.join("="))
  }
  for (const header of res.headers.getSetCookie()) {
    const [pair] = header.split(";")
    const [name, ...value] = pair.split("=")
    if (/max-age=0/i.test(header) || value.join("=") === "") jar.delete(name)
    else jar.set(name, value.join("="))
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ")
}

/** Cookie names set by a response, e.g. ["sp.session_token", "sp.session_data"]. */
export function cookieNames(res: Response): string[] {
  return res.headers.getSetCookie().map((c) => c.split("=")[0])
}

export function authPost(path: string, body: unknown, cookie?: string) {
  return app.request(`/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

/** Signs in over HTTP and returns the Cookie header for later requests. */
export async function signIn(email: string, password = TEST_PASSWORD) {
  const res = await authPost("/sign-in/email", { email, password })
  if (res.status !== 200)
    throw new Error(`sign-in failed (${res.status}): ${await res.text()}`)
  return cookiesFrom(res)
}

export async function signedInUser(roles: Role[]) {
  const user = await createUser({ roles })
  const cookie = await signIn(user.email)
  return { user, cookie }
}

/**
 * Request to the admin API as a signed-in user (same-origin, JSON).
 * `rawJson` sends an already-serialised JSON body as-is (e.g. hostile nesting
 * that JSON.stringify itself would overflow the stack on).
 */
export function adminRequest(
  path: string,
  opts: {
    cookie?: string
    method?: string
    json?: unknown
    rawJson?: string
  } = {}
) {
  const headers: Record<string, string> = { origin: ORIGIN }
  if (opts.cookie) headers.cookie = opts.cookie
  const body =
    opts.rawJson ??
    (opts.json === undefined ? undefined : JSON.stringify(opts.json))
  if (body !== undefined) headers["content-type"] = "application/json"
  return app.request(`/api/v1/admin${path}`, {
    method: opts.method ?? "GET",
    headers,
    body,
  })
}
