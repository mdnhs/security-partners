// The Figma careers openings (server/db/seed/demo-jobs.ts: five open roles,
// three previous openings) as demo data, then expires the careers cache
// through the server's signed internal route. Refuses non-disposable
// databases unless --allow-production. Remove before real roles go live.
//   pnpm demo:jobs [--allow-production]      add the missing ones
//   pnpm demo:jobs --remove                  delete them again
//   container: node scripts/dist/demo-jobs.mjs [--remove] [--allow-production]
import { parseArgs } from "node:util"

import { getDb } from "@/server/db/client"
import {
  DEMO_JOB_SLUGS,
  removeDemoJobs,
  seedDemoJobs,
} from "@/server/db/seed/demo-jobs"
import { assertDisposable } from "@/server/db/seed/guard"
import { getEnv } from "@/server/env"
import { tag } from "@/server/lib/cache-tags"
import { revalidateViaApi } from "@/server/lib/scheduler"

import { runScript } from "./lib/run-script"

await runScript("demo:jobs", async () => {
  const { values } = parseArgs({
    options: {
      remove: { type: "boolean", default: false },
      "allow-production": { type: "boolean", default: false },
    },
  })
  const db = getDb()
  let count: number
  if (values.remove) {
    count = await removeDemoJobs(db)
    console.log(`[demo:jobs] removed ${count} demo opening(s)`)
  } else {
    assertDisposable(getEnv().DATABASE_URL, values["allow-production"] ?? false)
    count = await seedDemoJobs(db)
    console.log(
      `[demo:jobs] added ${count} demo opening(s) (${DEMO_JOB_SLUGS.length - count} already there). Remove them with demo:jobs --remove before real roles go live.`
    )
  }
  try {
    await revalidateViaApi([
      tag.jobs,
      ...DEMO_JOB_SLUGS.map((slug) => tag.job(slug)),
    ])
  } catch (err) {
    console.warn(
      `[demo:jobs] The careers cache could not be refreshed (${err instanceof Error ? err.message : String(err)}). Restart the app to show the change now.`
    )
  }
})
