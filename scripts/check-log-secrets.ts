// Fails when a captured log (CI E2E server output) contains a known test
// secret or a single-use ?token= value. Never prints the secret itself.
//   pnpm exec tsx scripts/check-log-secrets.ts e2e.log [more.log…]
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

import { E2E_ENV } from "../tests/e2e/env"
import { E2E_PASSWORD } from "../tests/e2e/fixtures"
import { VISUAL_ADMIN } from "../tests/visual/admin-user"

const TOKEN_IN_URL = /[?&]token=[A-Za-z0-9_-]{16,}/

/** Labels of what leaked ("known secret #n", "a ?token= value"). */
export function findSecrets(
  text: string,
  secrets: readonly string[]
): string[] {
  const found = secrets.flatMap((secret, index) =>
    secret && text.includes(secret) ? [`known secret #${index + 1}`] : []
  )
  if (TOKEN_IN_URL.test(text)) found.push("a ?token= value")
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
  const secrets = [
    E2E_ENV.BETTER_AUTH_SECRET,
    E2E_PASSWORD,
    VISUAL_ADMIN.password,
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
