/**
 * The visitor's "No thanks" on the email request, remembered per chat in
 * this browser so the request stays hidden for that chat. Storage can be
 * missing or blocked (private windows): then it is only hidden until reload.
 */
const KEY_PREFIX = "cp-chat-email-ask-hidden:"

export function emailAskHidden(chatId: string): boolean {
  try {
    return window.localStorage.getItem(KEY_PREFIX + chatId) === "1"
  } catch {
    return false
  }
}

export function hideEmailAsk(chatId: string): void {
  try {
    window.localStorage.setItem(KEY_PREFIX + chatId, "1")
  } catch {
    // Not remembered; the in-memory state still hides it.
  }
}
