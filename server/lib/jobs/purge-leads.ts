import "server-only"

import { purgeExpiredLeads } from "@/server/modules/leads/service"

import type { JobDefinition } from "./index"

/** Spec §12: lead retention purge, daily. */
export const purgeLeadsJob: JobDefinition = {
  name: "purge-leads",
  key: "purge-leads",
  everyMs: 24 * 60 * 60_000,
  async run({ now }) {
    const { cutoff } = await purgeExpiredLeads(now)
    return cutoff
      ? {}
      : { warning: "settings.leads is not published; no leads purged" }
  },
}
