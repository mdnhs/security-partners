// Deletes every demo account (<role>@demo.local) — run before handover
// (docs/launch.md). Refuses while no real active owner exists.
//   pnpm demo:remove   |   node scripts/dist/demo-remove.mjs
import { removeDemoUsers } from "@/server/modules/users/bootstrap"

import { runScript } from "./lib/run-script"

await runScript("demo:remove", async () => {
  const { removed } = await removeDemoUsers()
  if (removed.length === 0) {
    console.log("[demo:remove] no demo accounts found")
    return
  }
  for (const email of removed) console.log(`[demo:remove] removed ${email}`)
  console.log(`[demo:remove] ${removed.length} demo account(s) removed`)
})
