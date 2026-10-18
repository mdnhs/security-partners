import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

/** Written by tests/e2e/seed.ts, read by the specs (gitignored). */
export const FIXTURES_FILE = resolve("tests/e2e/.state/fixtures.json")
export const E2E_PASSWORD = "e2e-password-0123456789"
/** SMTP password integrations.spec.ts saves (scripts/check-log-secrets.ts). */
export const E2E_SMTP_PASSWORD = "smtp-secret-1234"

export type E2EFixtures = {
  editor: { email: string; name: string }
  invitee: { email: string; name: string; inviteUrl: string }
  twoFactor: { email: string; name: string; totpUri: string }
  account: { email: string; name: string }
  /** Articles workflow (Phase 5): drafts and submits, never publishes. */
  author: { email: string; name: string }
  /** Leads (Phase 7): sees only Dashboard, Leads and Account. */
  intake: { email: string; name: string }
  /** settings.leads.recipients[0] in sp_e2e; mail lands in Mailpit. */
  leadsInbox: string
  /** 2FA on; account.spec turns it off. */
  twoFactorOff: { email: string; name: string; totpUri: string }
  /**
   * Its password changes in password-reset.spec. `resetUrl` is a reset link
   * minted by the seed: the production server never sends to the loopback
   * Mailpit (SMTP SSRF guard), so the email leg is integration-tested.
   */
  resetUser: { email: string; name: string; resetUrl: string }
}

/**
 * server.js runs with production rate limits (sign-in 5/min per IP, keyed
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

/** The dashboard's h1: "Good morning, Edith" (time of day in Ireland, first name). */
export function greeting(name: string): RegExp {
  const first = name
    .trim()
    .split(/\s+/)[0]!
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^Good (morning|afternoon|evening), ${first}$`)
}
