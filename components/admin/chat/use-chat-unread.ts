"use client"

import { useQuery } from "@tanstack/react-query"

import { chatUnreadQuery } from "./queries"

/**
 * The sidebar's unread-chats count, kept live: the panel layout's count
 * (`initial`) to start with, then polled every 30 s, in the background too.
 * undefined while unknown or for those who cannot read chats.
 */
export function useChatUnread(
  initial: number | undefined,
  enabled: boolean
): number | undefined {
  const { data } = useQuery(chatUnreadQuery(enabled, initial))
  return enabled ? data?.count : undefined
}
