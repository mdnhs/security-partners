import "server-only"

import type { ChatSettings } from "@/lib/schemas/settings/chat"
import { AppError } from "@/server/lib/errors"
import { readPublishedSettings } from "@/server/modules/settings/service"

export const CHAT_COOKIE = "cp_chat"
export const CHAT_COOKIE_PATH = "/api/v1/public/chat"
export const CHAT_COOKIE_MAX_AGE = 30 * 24 * 3600

/** The published chat settings; null when unpublished or no longer valid. */
export function readChatSettings(): Promise<ChatSettings | null> {
  return readPublishedSettings("chat")
}

/** 404 unless the chat is on: the widget never learns it exists. */
export async function requireEnabled(): Promise<ChatSettings> {
  const settings = await readChatSettings()
  if (!settings?.enabled) throw new AppError("NOT_FOUND", "Not found")
  return settings
}
