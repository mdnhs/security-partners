import { z } from "zod"

import { href } from "@/lib/schemas/common"

const str = (max: number) => z.string().trim().min(1).max(max)
const copyText = str(200)

/**
 * settings.chat: the live chat widget, its AI assistant and every text a
 * visitor sees in it ({team}, {botName}, {agent} and {name} are filled in by
 * lib/chat/text.ts). Never a public settings key: the launcher gets only the
 * copy it needs. Off by default (migration 0046 and the seed).
 */
export const chatSettings = z.object({
  enabled: z.boolean(),
  teamName: str(80),
  bot: z.object({
    enabled: z.boolean(),
    name: str(40),
    extraInstructions: z.string().trim().max(1000),
    maxAiReplies: z.number().int().min(1).max(50),
  }),
  hint: z.object({
    title: str(60),
    subtitle: str(100),
    presets: z
      .array(z.object({ label: str(60), message: z.string().trim().max(300) }))
      .max(6),
  }),
  copy: z.object({
    launcherOpen: copyText,
    launcherOpenUnread: copyText,
    close: copyText,
    hintGroup: copyText,
    hintDismiss: copyText,
    title: copyText,
    welcome: copyText,
    statusReconnecting: copyText,
    statusAgent: copyText,
    statusBot: copyText,
    statusOnline: copyText,
    statusOffline: copyText,
    conversation: copyText,
    aiCaption: copyText,
    typing: copyText,
    messageLabel: copyText,
    messagePlaceholder: copyText,
    send: copyText,
    startNew: copyText,
    connecting: copyText,
    consentBot: copyText,
    consentTeam: copyText,
    privacyLabel: copyText,
    privacyHref: href,
    offlineNote: copyText,
    emailPlaceholder: copyText,
    emailSave: copyText,
    // Added after 0046: stored settings without it get the default.
    emailDismiss: copyText.default("No thanks"),
    emailError: copyText,
    noticeOffline: copyText,
    noticeRate: copyText,
    noticeEnded: copyText,
    errorTooLong: copyText,
    errorStart: copyText,
    errorGeneric: copyText,
  }),
  notices: z.object({
    handoff: str(300),
    limit: str(300),
    failed: str(300),
    joined: str(300),
    back: str(300),
    ended: str(300),
  }),
  alerts: z.object({ includeMessage: z.boolean() }),
  retentionMonths: z.number().int().min(1).max(60),
})
export type ChatSettings = z.infer<typeof chatSettings>
