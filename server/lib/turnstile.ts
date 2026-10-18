import "server-only"

export const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify"

const TIMEOUT_MS = 10_000

/** Cloudflare Turnstile server check (spec §9). Any failure is `false`. */
export async function verifyTurnstileToken(
  input: { secret: string; token: string | undefined; ip: string | null },
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  if (!input.token) return false
  const body = new URLSearchParams({
    secret: input.secret,
    response: input.token,
  })
  if (input.ip) body.set("remoteip", input.ip)
  try {
    const res = await fetchImpl(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { success?: unknown }
    return data.success === true
  } catch {
    return false
  }
}
