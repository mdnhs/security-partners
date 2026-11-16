"use client"

import { MessageCircle, SendHorizontal, X } from "lucide-react"
import Link from "next/link"
import { type RefObject, useEffect, useId, useRef, useState } from "react"

import { useTurnstile } from "@/components/home/use-turnstile"
import { emailAskHidden, hideEmailAsk } from "@/lib/chat/email-ask"
import { fillChatText, type ChatWidgetProps } from "@/lib/chat/text"
import {
  CHAT_PUBLIC_ENDPOINT,
  SOURCE_PATH_MAX,
  type VisitorMessage,
} from "@/lib/schemas/api/chat"
import { cn } from "@/lib/utils"

import { linkify } from "./linkify"
import { TypingIndicator } from "./typing-indicator"
import { usePanelMoments } from "./use-chat-moments"
import type { ChatApi } from "./use-chat"
import { usePanelMotion } from "./use-widget-motion"

// Port of JW features/chat/chat-panel.tsx (live chat plan Task 9, JW §2.4)
// in CP tokens. Every visible string comes from settings copy (`props.copy`)
// through fillChatText; the server's own text is never shown.

// A preset question from the hint. `id` changes on every pick, so picking the
// same one twice fills it twice.
export type Preset = { id: number; text: string }

type Copy = ChatWidgetProps["copy"]

const TYPING_MS = 30_000
const MESSAGE_MAX = 2000
const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]), textarea:not([disabled]), a[href]'
// The site key comes from the chat's own /status (Turnstile for /start only).
const TURNSTILE_CONFIG = `${CHAT_PUBLIC_ENDPOINT}/status`

const fieldClass =
  "w-full rounded-2xl border border-white/12 bg-white/10 px-4 py-2.5 text-base text-white placeholder:text-white/50 focus-visible:border-white/35 focus-visible:bg-white/14 focus-visible:outline-none"
const pillClass =
  "inline-flex h-11 items-center justify-center rounded-full bg-brand-green px-6 text-base font-medium text-white transition-colors hover:bg-brand-green-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 disabled:opacity-60"
const bubbleClass =
  "max-w-[85%] rounded-2xl px-4 py-2.5 text-base leading-6 break-words whitespace-pre-wrap"
const theirsClass = "rounded-bl-md bg-white/12 text-white"

// Bodies render as React text, never as markup. Staff/AI replies get their
// emails, phone numbers and the quote link turned into links (see linkify).
function Bubble({
  m,
  aiCaption,
  quoteHref,
}: {
  m: VisitorMessage
  aiCaption: string
  quoteHref: string
}) {
  if (m.sender === "system") {
    return (
      <li
        data-message-id={m.id}
        data-sender={m.sender}
        className="px-4 text-center text-sm whitespace-pre-wrap text-white/60"
      >
        {m.body}
      </li>
    )
  }
  const mine = m.sender === "visitor"
  const caption =
    m.sender === "ai" ? aiCaption : m.sender === "staff" ? m.senderName : null
  return (
    <li
      data-message-id={m.id}
      data-sender={m.sender}
      className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}
    >
      {caption ? (
        <span className="px-1 text-xs font-medium text-white/60">
          {caption}
        </span>
      ) : null}
      <p
        className={cn(
          bubbleClass,
          mine
            ? "rounded-br-md bg-white text-brand-navy"
            : m.sender === "ai"
              ? theirsClass
              : "rounded-bl-md bg-white/18 text-white"
        )}
      >
        {mine ? m.body : linkify(m.body, { quoteHref })}
      </p>
    </li>
  )
}

function ConsentLine({
  quiet,
  text,
  copy,
}: {
  quiet: boolean
  text: string
  copy: Copy
}) {
  return (
    <p
      className={cn(
        "text-white/65",
        quiet ? "mt-2 text-xs leading-4" : "mb-2 text-[13px] leading-5"
      )}
    >
      {text}{" "}
      <Link
        href={copy.privacyHref}
        target="_blank"
        rel="noopener"
        className="underline underline-offset-2 hover:text-white"
      >
        {copy.privacyLabel}
      </Link>
    </p>
  )
}

function EmailAsk({
  chat,
  note,
  copy,
  onHide,
}: {
  chat: ChatApi
  note: string
  copy: Copy
  /** "No thanks": hides the request for this chat. */
  onHide(): void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const inputId = useId()
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const email = String(
      new FormData(e.currentTarget).get("email") ?? ""
    ).trim()
    setPending(true)
    const result = await chat.saveEmail(email)
    setPending(false)
    setError(result.ok ? null : copy.emailError)
  }
  return (
    <form
      onSubmit={submit}
      className="mt-1 flex flex-col gap-2 rounded-2xl bg-white/8 p-3"
    >
      <label htmlFor={inputId} className="text-sm text-white/85">
        {note}
      </label>
      <input
        id={inputId}
        name="email"
        type="email"
        required
        autoComplete="email"
        maxLength={254}
        placeholder={copy.emailPlaceholder}
        className={fieldClass}
      />
      <button type="submit" disabled={pending} className={pillClass}>
        {copy.emailSave}
      </button>
      <button
        type="button"
        onClick={onHide}
        className="self-center rounded-full px-3 py-1 text-sm text-white/70 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-white/70"
      >
        {copy.emailDismiss}
      </button>
      {error ? <p className="text-sm text-star">{error}</p> : null}
    </form>
  )
}

export function ChatPanel({
  open,
  onClose,
  onClosed,
  preset,
  props,
  chat,
  launcherRef,
}: {
  open: boolean
  onClose(): void
  onClosed(): void
  preset: Preset | null
  props: ChatWidgetProps
  chat: ChatApi
  /** Focus goes back here when the panel closes. */
  launcherRef?: RefObject<HTMLElement | null>
}) {
  const { copy, team, botName, quoteHref } = props
  const fill = (template: string) => fillChatText(template, { team, botName })

  const titleId = useId()
  const dialog = usePanelMotion(open, onClosed)
  const composer = useRef<HTMLTextAreaElement>(null)
  const restart = useRef<HTMLButtonElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const turnstileSlot = useRef<HTMLDivElement>(null)
  const turnstile = useTurnstile(turnstileSlot, TURNSTILE_CONFIG)
  const seen = useRef<Set<number> | null>(null)
  const inFlight = useRef(false)
  const wasOpen = useRef(open)

  const [draft, setDraft] = useState("")
  const [honeypot, setHoneypot] = useState("")
  const [sending, setSending] = useState(false)
  // A message waiting to go: for the cookie lookup, or for Turnstile.
  const [queued, setQueued] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const [expiredFor, setExpiredFor] = useState<number | null>(null)

  const { messages, loaded, exists, view, status } = chat
  const { botActive, agentName, hasEmail } = view
  const ended = view.status === "closed"
  const last = messages.at(-1)
  const online = status?.online ?? false
  // Before the first message there is no conversation to ask, so the site's
  // status says whether the assistant will answer.
  const botAnswers = exists ? botActive : (status?.botActive ?? false)

  const { avatar, statusLine, onlineDot } = usePanelMoments({
    messageIds: messages.map((m) => m.id),
    agentName,
    online,
    log: scroller,
  })

  // A new preset is sent at once, as if typed and sent (picking it is the
  // visitor's ask): it fills the composer and queues, so it waits for the
  // cookie lookup and Turnstile like any first message. Adjusted during
  // render, not in an effect. An ended chat has no composer, so it only
  // opens; a send already in flight keeps its own text.
  const [presetSeen, setPresetSeen] = useState(0)
  if (preset && preset.id !== presetSeen) {
    setPresetSeen(preset.id)
    if (preset.text && !ended && !sending) {
      setDraft(preset.text)
      setQueued(true)
    }
  }

  // Focus the composer on open (or Start a new chat once a chat ended), and
  // again when the view swaps between the two.
  useEffect(() => {
    if (!open) return
    if (ended) restart.current?.focus()
    else composer.current?.focus({ preventScroll: true })
  }, [open, ended])

  // Focus returns to the launcher when the panel closes.
  useEffect(() => {
    if (wasOpen.current && !open) launcherRef?.current?.focus()
    wasOpen.current = open
  }, [open, launcherRef])

  // Load Turnstile while the visitor writes the first message.
  const prepareTurnstile = turnstile.prepare
  useEffect(() => {
    if (open && loaded && !exists) void prepareTurnstile()
  }, [open, loaded, exists, prepareTurnstile])

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, last?.sender])

  // Screen readers hear only new messages from someone else, never the
  // visitor's own and never the history restored on open.
  useEffect(() => {
    if (!loaded) return
    if (!seen.current) {
      seen.current = new Set(messages.map((m) => m.id))
      return
    }
    const fresh = messages.filter((m) => !seen.current!.has(m.id))
    for (const m of fresh) seen.current.add(m.id)
    const text = fresh
      .filter((m) => m.sender !== "visitor")
      .map((m) => m.body)
      .join(". ")
    if (text) setAnnouncement(text)
  }, [messages, loaded])

  const typing =
    botActive && !ended && last?.sender === "visitor" && expiredFor !== last.id
  const lastVisitorId = last?.sender === "visitor" ? last.id : null
  useEffect(() => {
    if (lastVisitorId === null) return
    const id = lastVisitorId
    const t = setTimeout(() => setExpiredFor(id), TYPING_MS)
    return () => clearTimeout(t)
  }, [lastVisitorId])

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== "Tab") return
    const items = [
      ...(dialog.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
    ]
    if (!items.length) return
    const first = items[0]!
    const lastEl = items[items.length - 1]!
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === dialog.current)) {
      e.preventDefault()
      lastEl.focus()
    } else if (!e.shiftKey && active === lastEl) {
      e.preventDefault()
      first.focus()
    }
  }

  // The first message starts the chat; sending it is the consent. It waits
  // for the cookie lookup (an open chat must not be started twice) and, when
  // Turnstile is on, for its token.
  async function submit() {
    const body = draft.trim()
    // `sending` is state, so two calls before the next render (the queued
    // effect under StrictMode, a fast double Enter) would both pass it and
    // send the message twice. The ref closes that window synchronously.
    if (!body || sending || ended || inFlight.current) {
      if (!sending && !inFlight.current) setQueued(false)
      return
    }
    if (!exists && !loaded) {
      setQueued(true)
      return
    }
    inFlight.current = true
    setQueued(false)
    setSending(true)
    setError(null)
    if (exists) {
      const ok = await chat.send(body)
      inFlight.current = false
      setSending(false)
      if (ok) setDraft("")
      return
    }
    setVerifying(true)
    const token = await turnstile.getToken()
    setVerifying(false)
    const result = await chat.start({
      message: body,
      // Capped like the schema: a longer path would make /start fail (422).
      sourcePath: window.location.pathname.slice(0, SOURCE_PATH_MAX),
      website: honeypot,
      ...(token ? { turnstileToken: token } : {}),
    })
    inFlight.current = false
    setSending(false)
    // Tokens are single-use: reset after every start, so a retry or the next
    // chat (after Start a new chat) gets a fresh one.
    turnstile.reset()
    if (result.ok) setDraft("")
    else if (result.kind === "invalid")
      setError(result.fieldErrors.message ? copy.errorTooLong : copy.errorStart)
    else if (result.kind === "other" || result.kind === "notfound")
      setError(copy.errorGeneric)
  }

  useEffect(() => {
    if (!queued || sending || !(exists || loaded)) return
    // The queued message goes as soon as the lookup is done.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sends a message the visitor already asked to send
    void submit()
  })

  const statusText = chat.offline
    ? copy.statusReconnecting
    : agentName
      ? fillChatText(copy.statusAgent, { agent: agentName, team, botName })
      : botAnswers
        ? fill(copy.statusBot)
        : online
          ? copy.statusOnline
          : copy.statusOffline

  const notice =
    chat.notice === "offline"
      ? copy.noticeOffline
      : chat.notice === "rate"
        ? copy.noticeRate
        : chat.notice === "ended" || ended
          ? copy.noticeEnded
          : null

  const consent = fill(botAnswers ? copy.consentBot : copy.consentTeam)

  // VANTAGE's rule: ask only when no one can answer here and now.
  // Once per chat: "No thanks" hides it for good (remembered in this
  // browser), so it does not come back under every new message.
  const [hiddenFor, setHiddenFor] = useState<string | null>(null)
  const askHidden =
    !!view.id && (hiddenFor === view.id || emailAskHidden(view.id))
  const askEmail =
    exists &&
    !ended &&
    !agentName &&
    !hasEmail &&
    !botActive &&
    !online &&
    !askHidden
  const hideAsk = () => {
    hideEmailAsk(view.id)
    setHiddenFor(view.id)
    composer.current?.focus({ preventScroll: true })
  }

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      inert={!open}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-80 flex h-svh w-full flex-col overflow-hidden bg-brand-navy/72 text-white shadow-[0_24px_60px_-18px_rgb(0_0_0/0.6)] backdrop-blur-xl backdrop-saturate-150 outline-none sm:inset-auto sm:right-6 sm:bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4.75rem+var(--sticky-cta-h,0px))] sm:h-[min(560px,calc(100svh-7rem))] sm:w-95 sm:rounded-3xl"
    >
      <header
        data-chat-part
        className="flex items-center gap-3 bg-black/15 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 text-white sm:pt-4"
      >
        <span
          ref={avatar}
          className="relative grid size-11 shrink-0 place-items-center rounded-full bg-white/15 ring-1 ring-white/25"
        >
          {agentName ? (
            <span className="font-heading text-lg font-semibold">
              {agentName[0]?.toUpperCase()}
            </span>
          ) : (
            <MessageCircle className="size-5" aria-hidden />
          )}
          {online ? (
            <span
              ref={onlineDot}
              aria-hidden
              className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-brand-navy bg-emerald-400"
            />
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-heading text-xl leading-6 font-bold">
            {copy.title}
          </h2>
          <p
            ref={statusLine}
            className="truncate text-sm leading-5 text-white/75"
          >
            {statusText}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.close}
          className="grid size-11 shrink-0 place-items-center rounded-full text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white/70"
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div
        ref={scroller}
        data-chat-part
        data-lenis-prevent
        className="flex flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-4"
      >
        <ul
          role="log"
          aria-live="off"
          aria-label={copy.conversation}
          className="flex flex-col gap-3"
        >
          <li className="flex flex-col items-start">
            <p className={cn(bubbleClass, theirsClass)}>{fill(copy.welcome)}</p>
          </li>
          {messages.map((m) => (
            <Bubble
              key={m.id}
              m={m}
              aiCaption={fill(copy.aiCaption)}
              quoteHref={quoteHref}
            />
          ))}
        </ul>
        {typing ? <TypingIndicator label={fill(copy.typing)} /> : null}
        {askEmail ? (
          <EmailAsk
            chat={chat}
            note={fill(copy.offlineNote)}
            copy={copy}
            onHide={hideAsk}
          />
        ) : null}
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <div
        data-chat-part
        className="bg-black/10 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        {notice || error ? (
          <p role="alert" className="mb-2 text-sm text-star">
            {error ?? notice}
          </p>
        ) : null}
        {ended ? (
          <button
            ref={restart}
            type="button"
            onClick={chat.startNew}
            className={cn(pillClass, "w-full")}
          >
            {copy.startNew}
          </button>
        ) : (
          <>
            {!exists ? (
              <ConsentLine quiet={false} text={consent} copy={copy} />
            ) : null}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void submit()
              }}
              className="flex items-end gap-2"
            >
              <textarea
                ref={composer}
                aria-label={copy.messageLabel}
                placeholder={copy.messagePlaceholder}
                value={draft}
                rows={1}
                maxLength={MESSAGE_MAX}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault()
                    void submit()
                  }
                }}
                data-lenis-prevent
                className={cn(
                  fieldClass,
                  "max-h-28 min-h-11 min-w-0 flex-1 resize-none"
                )}
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                aria-label={copy.send}
                className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-brand-navy transition-colors hover:bg-brand-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 disabled:opacity-50"
              >
                <SendHorizontal className="size-5" aria-hidden />
              </button>
            </form>
            {(queued || verifying) && !exists ? (
              <p role="status" className="mt-2 text-xs text-white/65">
                {copy.connecting}
              </p>
            ) : null}
            {exists ? <ConsentLine quiet text={consent} copy={copy} /> : null}
          </>
        )}
        {/* Invisible Turnstile (CP's contact-form hook): no layout. */}
        <div ref={turnstileSlot} className="absolute h-0 w-0 overflow-hidden" />
        {/* Off-screen for people; bots fill it in. */}
        <input
          tabIndex={-1}
          aria-hidden
          autoComplete="off"
          name="website"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          className="absolute -left-[9999px] size-px opacity-0"
        />
      </div>
    </div>
  )
}

export default ChatPanel
