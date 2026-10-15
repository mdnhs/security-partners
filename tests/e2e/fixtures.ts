import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

/** Written by tests/e2e/seed.ts, read by the specs (gitignored). */
export const FIXTURES_FILE = resolve("tests/e2e/.state/fixtures.json")
export const E2E_PASSWORD = "e2e-password-0123456789"

export type E2EFixtures = {
  editor: { email: string; name: string }
  invitee: { email: string; name: string; inviteUrl: string }
  twoFactor: { email: string; name: string; totpUri: string }
  account: { email: string; name: string }
}

/**
 * `next start` runs with production rate limits (sign-in 5/min per IP, keyed
 * on X-Forwarded-For). Each test signs in from its own documentation-range
 * address so the suite never trips a limit meant for one client.
 */
export function clientIpFor(testTitle: string): string {
  const [a, b] = createHash("sha256").update(testTitle).digest()
  return `198.18.${a}.${b}`
}

export function readFixtures(): E2EFixtures {
  return JSON.parse(readFileSync(FIXTURES_FILE, "utf8")) as E2EFixtures
}
