// After BETTER_AUTH_SECRET changed (spec §4): re-encrypts every integration
// secret from the old derived key to the new one, turns 2FA off for everyone
// (users re-enrol) and signs everyone out. The NEW secret must already be in
// the environment. See docs/runbook.md "Rotate BETTER_AUTH_SECRET".
//   pnpm secrets:rotate --from-secret "<previous secret>"
//   OLD_BETTER_AUTH_SECRET="<previous secret>" node scripts/dist/secrets-rotate.mjs
import { parseArgs } from "node:util"

import { getEnv } from "@/server/env"
import { rotateSecrets } from "@/server/modules/integrations/rotate"

import { runScript } from "./lib/run-script"

const USAGE =
  'Usage: secrets:rotate --from-secret "<previous BETTER_AUTH_SECRET>" (or set OLD_BETTER_AUTH_SECRET)'

await runScript("secrets:rotate", async () => {
  const { values } = parseArgs({
    options: { "from-secret": { type: "string" } },
  })
  const fromSecret = values["from-secret"] || process.env.OLD_BETTER_AUTH_SECRET
  if (!fromSecret) throw new Error(USAGE)
  if (fromSecret === getEnv().BETTER_AUTH_SECRET)
    throw new Error(
      "The old secret equals the current BETTER_AUTH_SECRET: set the new secret in the environment first (docs/runbook.md)."
    )
  const report = await rotateSecrets({ fromSecret })
  console.log(
    `[secrets:rotate] re-encrypted ${report.reencrypted.length} secret(s)${report.reencrypted.length ? `: ${report.reencrypted.join(", ")}` : ""}`
  )
  if (report.alreadyCurrent.length)
    console.log(
      `[secrets:rotate] already on the new secret: ${report.alreadyCurrent.join(", ")}`
    )
  console.log(
    `[secrets:rotate] two-factor turned off for ${report.twoFactorCleared} user(s); ${report.sessionsRevoked} session(s) ended. Everyone signs in again; 2FA users re-enrol.`
  )
})
