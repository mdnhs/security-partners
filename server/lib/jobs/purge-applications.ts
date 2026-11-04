import "server-only"

import { purgeExpiredApplications } from "@/server/modules/applications/service"

import type { JobDefinition } from "./index"

/** Careers: job applications (and their files) past settings.careers.retentionMonths, daily. */
export const purgeApplicationsJob: JobDefinition = {
  name: "purge-applications",
  key: "purge-applications",
  everyMs: 24 * 60 * 60_000,
  async run({ now }) {
    const { cutoff } = await purgeExpiredApplications(now)
    return cutoff
      ? {}
      : { warning: "settings.careers is not published; no applications purged" }
  },
}
