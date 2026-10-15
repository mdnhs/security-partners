// Recovers a locked-out owner: turns 2FA off, signs out all sessions and
// prints a password link. Audited (user.owner_recover).
//   dev:       pnpm owner:recover --email owner@example.ie
//   container: node scripts/dist/owner-recover.mjs --email …
import { parseArgs } from "node:util"

import { recoverOwner } from "@/server/modules/users/bootstrap"

import { runScript } from "./lib/run-script"

const USAGE = "Usage: owner:recover --email <owner email>"

await runScript("owner:recover", async () => {
  const { values } = parseArgs({ options: { email: { type: "string" } } })
  if (!values.email) throw new Error(USAGE)
  const result = await recoverOwner({ email: values.email })
  console.log(
    `[owner:recover] Two-factor authentication cleared and all sessions signed out for ${values.email.trim().toLowerCase()}.`
  )
  console.log(
    result.emailDelivered
      ? "[owner:recover] Recovery email sent. The link (single use, valid 24 hours):"
      : "[owner:recover] Email is not configured. Give the owner this link (single use, valid 24 hours):"
  )
  console.log(result.url)
})
