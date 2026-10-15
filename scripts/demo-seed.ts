// One demo account per role (<role>@demo.local) sharing one password.
// Remove before handover (docs/launch.md). Refuses non-disposable databases.
//   pnpm demo:seed --password "<12+ chars>" [--allow-production]
import { parseArgs } from "node:util"

import { assertDisposable } from "@/server/db/seed/guard"
import { getEnv } from "@/server/env"
import { seedDemoUsers } from "@/server/modules/users/bootstrap"

import { runScript } from "./lib/run-script"

const USAGE =
  'Usage: demo:seed --password "<12+ characters>" [--allow-production]'

await runScript("demo:seed", async () => {
  const { values } = parseArgs({
    options: {
      password: { type: "string" },
      "allow-production": { type: "boolean", default: false },
    },
  })
  if (!values.password) throw new Error(USAGE)
  assertDisposable(getEnv().DATABASE_URL, values["allow-production"] ?? false)
  const users = await seedDemoUsers(values.password)
  for (const user of users)
    console.log(
      `[demo:seed] ${user.created ? "created" : "reset  "} ${user.email} (${user.role})`
    )
  console.log(
    `[demo:seed] ${users.length} demo accounts ready. Remove them before handover.`
  )
})
