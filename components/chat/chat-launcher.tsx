"use client"

import { MessageCircle, X } from "lucide-react"
import dynamic from "next/dynamic"
import { useCallback, useEffect, useRef, useState } from "react"

import type { ChatWidgetProps } from "@/lib/chat/text"

import { ChatHint } from "./chat-hint"
import type { Preset } from "./chat-panel"
import { useChat } from "./use-chat"
import { useUnreadMoment } from "./use-chat-moments"
import { useLauncherMotion } from "./use-widget-motion"

// Port of JW features/chat/chat-launcher.tsx (live chat plan §2.1, §2.2, §4).
// The panel (thread, composer, Turnstile) stays out of the page bundle until
// the first open. The launcher owns the polling hook so the unread badge
// works while the panel is closed.
const ChatPanel = dynamic(() => import("./chat-panel"), { ssr: false })

export function ChatLauncher(props: ChatWidgetProps) {
  const { copy, hint } = props
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const [hintHidden, setHintHidden] = useState(true)
  const [hintEntered, setHintEntered] = useState(false)
  const [preset, setPreset] = useState<Preset | null>(null)
  // The panel outlives `open` so it can animate away; assistive tech follows
  // `open` at once.
  const [panelMounted, setPanelMounted] = useState(false)
  if (open && !panelMounted) setPanelMounted(true)

  const presetId = useRef(0)
  const chat = useChat({ open })
  const { launcher, chatIcon, closeIcon } = useLauncherMotion(ready, open)
  const badge = useUnreadMoment(chat.unread, launcher)

  useEffect(() => {
    // Browser-only, after hydration: the launcher renders nothing on the
    // server so its arrival can animate.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setReady(true)
    // Hiding the hint lasts for this page view only: a reload or the next
    // page offers the presets again. Nothing is stored.
    setHintHidden(false)
  }, [])

  // Reopening mid-close plays the panel forward again, so it never reports
  // closed while open; render puts it back if it ever does. Focus goes back
  // to the launcher from the panel itself (launcherRef).
  const onClosed = useCallback(() => setPanelMounted(false), [])

  if (!ready) return null

  // A plain state update in the event handler (no transition): use-chat's
  // unread guard relies on the open render committing at once.
  const openPanel = (message?: string) => {
    setOpen(true)
    chat.refreshStatus()
    // The launcher itself sends nothing: clear the last preset, or the panel
    // (remounted after a close) would take it for a new one and send it.
    setPreset(message ? { id: ++presetId.current, text: message } : null)
  }
  const close = () => setOpen(false)
  const online = chat.status?.online ?? false

  return (
    <>
      {panelMounted ? (
        <ChatPanel
          open={open}
          onClose={close}
          onClosed={onClosed}
          preset={preset}
          props={props}
          chat={chat}
          launcherRef={launcher}
        />
      ) : null}
      <div
        style={{
          bottom:
            "calc(max(1rem, env(safe-area-inset-bottom)) + var(--sticky-cta-h, 0px))",
        }}
        className="fixed right-4 z-40 flex items-end gap-3 transition-[bottom] duration-300 ease-out motion-reduce:transition-none sm:right-6"
      >
        {!open && !hintHidden ? (
          <ChatHint
            hint={hint}
            copy={copy}
            online={online}
            skipEntrance={hintEntered}
            onEntered={() => setHintEntered(true)}
            onOpen={openPanel}
            onGone={() => setHintHidden(true)}
          />
        ) : null}
        <button
          ref={launcher}
          type="button"
          aria-label={
            open
              ? copy.close
              : chat.unread
                ? copy.launcherOpenUnread
                : copy.launcherOpen
          }
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => (open ? close() : openPanel())}
          className="relative grid size-14 shrink-0 cursor-pointer place-items-center rounded-full bg-brand-green text-white shadow-lg transition-colors hover:bg-brand-green-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green motion-reduce:transition-none"
        >
          <span
            ref={chatIcon}
            className="absolute inset-0 grid place-items-center"
          >
            <MessageCircle className="size-6.5" strokeWidth={1.8} aria-hidden />
          </span>
          <span
            ref={closeIcon}
            className="absolute inset-0 grid place-items-center opacity-0"
          >
            <X className="size-6.5" strokeWidth={1.8} aria-hidden />
          </span>
          {chat.unread && !open ? (
            <span
              ref={badge}
              aria-hidden
              className="absolute top-0.5 right-0.5 size-4 rounded-full border-2 border-white bg-star"
            />
          ) : online ? (
            <span
              aria-hidden
              className="absolute top-0.5 right-0.5 size-3.5 rounded-full border-2 border-white bg-emerald-500"
            />
          ) : null}
        </button>
      </div>
    </>
  )
}
