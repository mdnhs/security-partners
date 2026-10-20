// Fails when a captured log (CI E2E server output) contains a known test
// secret or a single-use ?token= value. Never prints the secret itself.
//   pnpm exec tsx scripts/check-log-secrets.ts e2e.log [more.log…]
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

import { E2E_ENV } from "../tests/e2e/env"
import { E2E_PASSWORD, E2E_SMTP_PASSWORD } from "../tests/e2e/fixtures"
import { VISUAL_ADMIN } from "../tests/visual/admin-user"

/** Credential shapes that must never reach a log, with their labels. */
const PATTERNS: [RegExp, string][] = [
  // Plain or URL-encoded (?next=…%3Ftoken%3D…) single-use links.
  [/(?:[?&]|%3F|%26)token(?:=|%3D)[A-Za-z0-9_-]{16,}/i, "a ?token= value"],
  // Better Auth session cookie (sp.session_token, __Secure-sp.session_token).
  [/session_token=[A-Za-z0-9_.%+/=-]{16,}/, "a session cookie"],
  [/"token"\s*:\s*"[A-Za-z0-9_.-]{16,}"/, "a JSON token"],
  [/\bBearer\s+[A-Za-z0-9._~+/-]{16,}/i, "a Bearer token"],
]

/** Labels of what leaked ("known secret #n", "a ?token= value", …). */
export function findSecrets(
  text: string,
  secrets: readonly string[]
): string[] {
  const found = secrets.flatMap((secret, index) =>
    secret && text.includes(secret) ? [`known secret #${index + 1}`] : []
  )
  for (const [pattern, label] of PATTERNS)
    if (pattern.test(text)) found.push(label)
  return found
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const files = process.argv.slice(2)
  if (files.length === 0) {
    console.error("Usage: tsx scripts/check-log-secrets.ts <log file>…")
    process.exit(2)
  }
  // Every secret the E2E/visual fixtures put into the server.
  const secrets = [
    E2E_ENV.BETTER_AUTH_SECRET,
    E2E_PASSWORD,
    VISUAL_ADMIN.password,
    E2E_SMTP_PASSWORD,
  ]
  let failed = false
  for (const file of files) {
    const found = findSecrets(readFileSync(file, "utf8"), secrets)
    if (found.length) {
      failed = true
      console.error(`[check-log-secrets] ${file}: ${found.join(", ")}`)
    }
  }
  if (failed) process.exit(1)
  console.log(`[check-log-secrets] ${files.length} log(s) clean`)
}
