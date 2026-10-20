import "server-only"

import { purgeStalePending } from "@/server/modules/newsletter/service"

import type { JobDefinition } from "./index"

/** Spec §7.4: unconfirmed newsletter sign-ups older than pendingDays, daily. */
export const purgeNewsletterJob: JobDefinition = {
  name: "purge-newsletter",
  key: "purge-newsletter",
  everyMs: 24 * 60 * 60_000,
  async run({ now }) {
    const purged = await purgeStalePending(now)
    return purged === null
      ? { warning: "settings.newsletter is not published; no sign-ups purged" }
      : {}
  },
}
