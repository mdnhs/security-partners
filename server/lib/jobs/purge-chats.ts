import "server-only"

import { purgeExpiredChats } from "@/server/modules/chat/sweep"

import type { JobDefinition } from "./index"

/** Live chat retention: chats past Settings › Live chat retentionMonths, daily. */
export const purgeChatsJob: JobDefinition = {
  name: "purge-chats",
  key: "purge-chats",
  everyMs: 24 * 60 * 60_000,
  async run({ now }) {
    await purgeExpiredChats(now)
    return {}
  },
}
