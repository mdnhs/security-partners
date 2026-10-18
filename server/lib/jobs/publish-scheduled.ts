import "server-only"

import { publishDueArticles } from "@/server/modules/articles/service"

import type { JobDefinition } from "./index"

/** Due at every 60 s tick (30 s < tick interval absorbs timer drift). */
export const publishScheduledJob: JobDefinition = {
  name: "publish-scheduled",
  key: "publish-scheduled",
  everyMs: 30_000,
  async run({ now }) {
    const { tags, failed } = await publishDueArticles(now)
    return {
      tags,
      warning:
        failed.length > 0 ? `Not published: ${failed.join("; ")}` : undefined,
    }
  },
}
