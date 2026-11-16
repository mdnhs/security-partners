import type { ChatSettings } from "@/lib/schemas/settings/chat"

/** The placeholders a chat text may hold (settings.chat copy and notices). */
export type ChatTextValues = Partial<
  Record<"team" | "botName" | "agent" | "name", string>
>

const PLACEHOLDER = /\{(team|botName|agent|name)\}/g

/**
 * Fills {team}, {botName}, {agent} and {name} where a value is given. Any
 * other {…}, or one without a value, stays as typed. Pure and isomorphic.
 */
export function fillChatText(template: string, values: ChatTextValues): string {
  return template.replace(
    PLACEHOLDER,
    (match, key: keyof ChatTextValues) => values[key] ?? match
  )
}

/** Where a visitor asks for a quote: the contact form page. */
export const CHAT_QUOTE_HREF = "/contact"

/** What the launcher, hint and panel get: copy stays templated, names are set. */
export type ChatWidgetProps = {
  copy: ChatSettings["copy"]
  hint: ChatSettings["hint"]
  team: string
  botName: string
  quoteHref: string
}

/**
 * The widget props from the published settings, worked out once on the
 * server: the team and bot names travel beside the templates they fill.
 */
export function chatLauncherProps(chat: ChatSettings): ChatWidgetProps {
  return {
    copy: chat.copy,
    hint: chat.hint,
    team: chat.teamName,
    botName: chat.bot.name,
    quoteHref: CHAT_QUOTE_HREF,
  }
}
