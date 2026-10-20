// Creates an owner account and prints its set-password link.
//   dev:       pnpm admin:create --email owner@example.ie --name "Jane Owner"
//   container: node scripts/dist/admin-create.mjs --email … --name …
import { parseArgs } from "node:util"

import { createOwner } from "@/server/modules/users/bootstrap"

import { runScript } from "./lib/run-script"

const USAGE = 'Usage: admin:create --email <email> --name "<full name>"'

await runScript("admin:create", async () => {
  const { values } = parseArgs({
    options: { email: { type: "string" }, name: { type: "string" } },
  })
  if (!values.email || !values.name) throw new Error(USAGE)
  const result = await createOwner({ email: values.email, name: values.name })
  console.log(
    `[admin:create] Owner created: ${values.name.trim()} <${values.email.trim().toLowerCase()}>`
  )
  console.log(
    result.emailDelivered
      ? "[admin:create] Invite email sent. The link (single use, valid 7 days):"
      : "[admin:create] Email is not configured. Give the owner this link (single use, valid 7 days):"
  )
  console.log(result.url)
})
