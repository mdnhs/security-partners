// Kill switch for owner custom code: switches every snippet off on the live
// site (published and draft `disabled: true`), audited with no actor
// (customCode.killSwitch), then expires the cached value through the
// server's signed internal route. Needs only DATABASE_URL,
// BETTER_AUTH_SECRET and BETTER_AUTH_URL, so it works while the owner is
// locked out of the admin (e.g. a snippet breaks it).
//   dev:       pnpm custom-code:off
//   container: node scripts/dist/custom-code-off.mjs
// Undo: Marketing › Custom code, turn "Switch all custom code off" off, publish.
import { pathToFileURL } from "node:url"

import type { Db } from "@/server/db/client"
import { getDb } from "@/server/db/client"
import { writeAudit } from "@/server/lib/audit"
import { tag } from "@/server/lib/cache-tags"
import { revalidateViaApi } from "@/server/lib/scheduler"
import { disableCustomCode } from "@/server/modules/settings/repo"

import { runScript } from "./lib/run-script"

/**
 * Sets customCode `disabled` on the draft and the published value (an
 * unpublished value stays unpublished), bumps the row version so an open
 * editor cannot silently overwrite it, writes the audit row in the same
 * transaction, then expires tag.settings("customCode"). Returns without
 * change or audit when there is no customCode row. If the cache refresh
 * fails, the switch is already off in the database; the error says so.
 */
export async function customCodeOff(
  db: Db,
  now: Date = new Date(),
  revalidate: (tags: string[]) => Promise<void> = revalidateViaApi
): Promise<void> {
  const changed = await db.transaction(async (tx) => {
    if (!(await disableCustomCode(tx, now))) return false
    await writeAudit(tx, null, {
      action: "customCode.killSwitch",
      entityType: "settings",
      entityId: "customCode",
      diff: { disabled: true, at: now.toISOString() },
    })
    return true
  })
  if (!changed) {
    console.warn(
      "[custom-code:off] There are no custom code settings: nothing to switch off."
    )
    return
  }
  try {
    await revalidate([tag.settings("customCode")])
  } catch (err) {
    throw new Error(
      `Custom code is switched off in the database, but the site's cache could not be refreshed (${err instanceof Error ? err.message : String(err)}). Restart the app to apply it now.`
    )
  }
  console.log(
    "[custom-code:off] Custom code is switched off on the live site. Turn it back on in Marketing › Custom code and publish."
  )
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await runScript("custom-code:off", () => customCodeOff(getDb()))
}
