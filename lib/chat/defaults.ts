import type { ChatSettings } from "@/lib/schemas/settings/chat"

const preset = (text: string) => ({ label: text, message: text })

/**
 * The stored default of settings.chat: migration 0026 inserts exactly this
 * value (tests/unit/chat/settings.test.ts) and the seed uses it. Off until
 * an admin turns it on.
 */
export const CHAT_SETTINGS_DEFAULT: ChatSettings = {
  enabled: false,
  teamName: "the Security Partners team",
  bot: {
    enabled: false,
    name: "Assistant",
    extraInstructions: "",
    maxAiReplies: 20,
  },
  hint: {
    title: "How can we help?",
    subtitle: "Questions about security or a quote?",
    presets: [
      preset("Can I get a quote?"),
      preset("Which areas do you cover?"),
      preset("Do you offer mobile patrols?"),
      preset("Is your team licensed and insured?"),
      preset("How do I arrange security cover?"),
    ],
  },
  copy: {
    launcherOpen: "Open chat",
    launcherOpenUnread: "Open chat, new message",
    close: "Close chat",
    hintGroup: "Chat options",
    hintDismiss: "Hide this message",
    title: "Chat with us",
    welcome: "Hi, how can we help?",
    statusReconnecting: "Reconnecting…",
    statusAgent: "Chatting with {agent}",
    statusBot: "{botName} (AI) · {team} can join",
    statusOnline: "We're online",
    statusOffline: "We'll reply as soon as we can",
    conversation: "Conversation",
    aiCaption: "{botName} · AI",
    typing: "{botName} is typing…",
    messageLabel: "Your message",
    messagePlaceholder: "Write a message",
    send: "Send message",
    startNew: "Start a new chat",
    connecting: "One moment, connecting…",
    consentBot: "Messages are read by an AI assistant and {team}.",
    consentTeam: "Messages are read by {team}.",
    privacyLabel: "Privacy notice",
    privacyHref: "/privacy",
    offlineNote:
      "No one is online right now. Leave your email and {team} will reply.",
    emailPlaceholder: "name@example.com",
    emailSave: "Save email",
    emailDismiss: "No thanks",
    emailError: "Please check that email address and try again.",
    noticeOffline: "You seem to be offline. We'll keep trying.",
    noticeRate: "You're sending messages quickly. Please wait a moment.",
    noticeEnded: "This chat has ended.",
    errorTooLong: "Please write a shorter message.",
    errorStart: "We couldn't start the chat. Please try again.",
    errorGeneric: "Something went wrong. Please try once more.",
  },
  notices: {
    handoff:
      "I've asked {team} to join. They'll reply here, or by email if you leave one.",
    limit: "I've passed this chat to {team} so a person can help from here.",
    failed:
      "The assistant is unavailable right now. We've let {team} know, and they'll reply soon.",
    joined: "{name} joined the chat.",
    back: "The assistant is back on this chat.",
    ended: "This chat has ended.",
  },
  alerts: { includeMessage: true },
  retentionMonths: 12,
}
