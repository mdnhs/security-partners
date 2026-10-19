"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowUp,
  FileText,
  History,
  Sparkles,
  Square,
  SquarePen,
  Trash2,
  X,
} from "lucide-react"
import {
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import Link from "next/link"
import { toast } from "sonner"

import { LINK_FORM } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { errorMessage } from "@/lib/api-client"
import { AI_MAX_MESSAGE_CHARS, type AiStatusDto } from "@/lib/schemas/api/ai"
import { cn } from "@/lib/utils"

import { useAssistant } from "./assistant-context"
import { chatContextFrom, insertText, starterPrompts } from "./chat-context"
import { MessageList } from "./message-list"
import {
  AI_CONVERSATIONS_KEY,
  deleteConversation,
  fetchConversations,
} from "./queries"
import type { AssistantChat } from "./use-assistant-chat"

/**
 * The assistant (spec §8.3) as a right panel: suggestions only — the user
 * inserts or copies them and saves as usual.
 */
export function AssistantPanel({
  open,
  onOpenChange,
  status,
  chat,
  trigger,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  status: AiStatusDto
  chat: AssistantChat
  trigger: RefObject<HTMLButtonElement | null>
}) {
  const assistant = useAssistant()
  const [draft, setDraft] = useState("")
  // The "Using: …" chip: ✕ leaves the screen out of the next message only.
  const [shareScreen, setShareScreen] = useState(true)
  const composer = useRef<HTMLTextAreaElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const scroller = useRef<HTMLElement>(null)
  // Focus on close: the field a suggestion went into, else the button.
  const returnFocus = useRef<HTMLElement | null>(null)
  const readOnly = status.readOnly
  const sharedScreen = shareScreen ? assistant.screen : null
  const sharedField = sharedScreen ? assistant.field : null

  useEffect(() => {
    if (open) returnFocus.current = null
  }, [open])

  // Follow the conversation as replies arrive.
  useLayoutEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chat.messages, chat.error])

  /**
   * The screen for the next request, unless the chip was dismissed; that
   * request uses it up and the chip comes back.
   */
  const takeContext = () => {
    const context = sharedScreen
      ? chatContextFrom(assistant.snapshot(), assistant.field)
      : undefined
    setShareScreen(true)
    return context
  }

  const send = () => {
    const message = draft.trim()
    if (!message || chat.busy || readOnly) return
    void chat.send(message, takeContext())
    setDraft("")
  }

  const regenerate = () => {
    if (chat.busy || readOnly) return
    void chat.regenerate(takeContext())
  }

  const edit = (messageId: string, text: string) => {
    if (chat.busy || readOnly) return
    void chat.edit(messageId, text, takeContext())
  }

  // One short line for screen readers instead of every streamed piece.
  const summary = chat.busy
    ? "The assistant is writing…"
    : chat.outcome === "answered"
      ? "The assistant has answered."
      : chat.outcome === "stopped"
        ? "Stopped. The answer so far is kept."
        : ""

  const insert = (reply: string) => {
    const field = assistant.field
    if (!field || readOnly) return
    const fit = insertText(reply, field)
    if (!fit.ok) {
      toast.error(
        `Too long for “${field.label}” (${fit.length}/${fit.max}) — copy it instead`
      )
      return
    }
    const previous = field.read()
    if (field.apply(fit.text) === false) {
      toast.error(`“${field.label}” is no longer on the form — copy it instead`)
      return
    }
    // Back to the field, unless it sits in a hidden section tab (then the
    // AI button, via finalFocus).
    const target = document.getElementById(field.elementId)
    returnFocus.current = target && !target.closest("[hidden]") ? target : null
    toast.success(`Inserted into “${field.label}”`, {
      description: "Check it, then save or publish as usual.",
      action: { label: "Undo", onClick: () => void field.apply(previous) },
      // Time to reach Undo (final review M5).
      duration: 10_000,
    })
    onOpenChange(false)
  }

  const prompts = starterPrompts(
    assistant.screen,
    assistant.field?.label ?? null
  )

  if (!status.available)
    return (
      <UnavailablePanel
        open={open}
        onOpenChange={onOpenChange}
        canManage={status.canManage}
        trigger={trigger}
      />
    )

  return (
    <Sheet open={open} onOpenChange={(next) => onOpenChange(next)}>
      <SheetContent
        side="right"
        showCloseButton={false}
        // Read-only: the composer is disabled, so focus starts on Close.
        initialFocus={readOnly ? closeButton : composer}
        // Ctrl+J ignores other modal dialogs, not this one (hotkey toggles it).
        data-assistant-panel=""
        finalFocus={() => returnFocus.current ?? trigger.current ?? true}
        className="w-full gap-0 overflow-hidden bg-sidebar p-0 data-[side=right]:w-full sm:data-[side=right]:max-w-[33rem]"
      >
        <SheetHeader className="flex-row items-center gap-3 border-b px-4 py-3 sm:px-5">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Sparkles className="size-4" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <SheetTitle className="text-[0.9375rem] leading-tight font-semibold">
              AI assistant
            </SheetTitle>
            <SheetDescription className="flex min-w-0">
              <span className="truncate rounded-full border bg-card px-2 py-px text-xs">
                <span className="sr-only">Model: </span>
                {status.model}
              </span>
            </SheetDescription>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-full pointer-coarse:size-11"
              aria-label="New chat"
              onClick={() => {
                chat.reset()
                setDraft("")
                composer.current?.focus()
              }}
            >
              <SquarePen />
            </Button>
            <HistoryMenu
              activeId={chat.conversationId}
              onOpen={(id) => void chat.open(id)}
              onDeletedActive={chat.reset}
              readOnly={readOnly}
            />
            <SheetClose
              render={
                <Button
                  ref={closeButton}
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full pointer-coarse:size-11"
                  aria-label="Close"
                />
              }
            >
              <X />
            </SheetClose>
          </div>
        </SheetHeader>

        <section
          ref={scroller}
          // Not a live region: streamed pieces would flood screen readers.
          // The status line below announces a summary instead.
          aria-label="Conversation"
          aria-busy={chat.busy}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          <div className="flex flex-col gap-5 px-4 py-5 sm:px-6">
            {chat.messages.length === 0 ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Ask for a draft, a rewrite, SEO help or a summary. Suggestions
                  appear here; nothing on the site changes until you insert or
                  copy one and save.
                </p>
                <ul
                  className="flex flex-col gap-2"
                  aria-label="Suggested questions"
                >
                  {prompts.map((prompt) => (
                    <li key={prompt}>
                      <button
                        type="button"
                        disabled={readOnly}
                        className="w-full rounded-xl border bg-card px-3 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:min-h-11"
                        onClick={() => {
                          setDraft(prompt)
                          composer.current?.focus()
                        }}
                      >
                        {prompt}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <MessageList
                messages={chat.messages}
                insertLabel={
                  !readOnly && assistant.field ? assistant.field.label : null
                }
                onInsert={insert}
                canAct={!chat.busy && !readOnly}
                onRegenerate={regenerate}
                onEdit={edit}
              />
            )}
          </div>
        </section>
        <p role="status" aria-live="polite" className="sr-only">
          {summary}
        </p>
        {/* Outside the log: announced once as an alert, not again by the log. */}
        {chat.error ? (
          <p
            role="alert"
            className="bg-danger-soft text-danger mx-4 mt-3 shrink-0 rounded-xl px-3 py-2 text-sm sm:mx-6"
          >
            {chat.error}
          </p>
        ) : null}

        <Composer
          boxRef={composer}
          draft={draft}
          onDraft={setDraft}
          onSend={send}
          onStop={chat.stop}
          busy={chat.busy}
          readOnly={readOnly}
          screenTitle={sharedScreen?.title ?? null}
          fieldLabel={sharedField?.label ?? null}
          onDismissScreen={() => {
            setShareScreen(false)
            composer.current?.focus()
          }}
        />
      </SheetContent>
    </Sheet>
  )
}

/** Set-up path while the assistant is off or not set up (MK parity C7). */
const AI_SETTINGS_HREF = "/admin/settings/ai-assistant"

/**
 * The panel while the assistant is off, not set up or not allowed: only
 * managers see the button then (AssistantButton), and they get a link to
 * the settings. No conversation is loaded or sent.
 */
function UnavailablePanel({
  open,
  onOpenChange,
  canManage,
  trigger,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  canManage: boolean
  trigger: RefObject<HTMLButtonElement | null>
}) {
  const closeButton = useRef<HTMLButtonElement>(null)
  const setUp = useRef<HTMLAnchorElement>(null)
  return (
    <Sheet open={open} onOpenChange={(next) => onOpenChange(next)}>
      <SheetContent
        side="right"
        showCloseButton={false}
        initialFocus={canManage ? setUp : closeButton}
        data-assistant-panel=""
        finalFocus={() => trigger.current ?? true}
        className="w-full gap-0 overflow-hidden bg-sidebar p-0 data-[side=right]:w-full sm:data-[side=right]:max-w-[33rem]"
      >
        <SheetHeader className="flex-row items-center gap-3 border-b px-4 py-3 sm:px-5">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Sparkles className="size-4" />
          </span>
          <SheetTitle className="flex-1 text-[0.9375rem] leading-tight font-semibold">
            AI assistant
          </SheetTitle>
          <SheetClose
            render={
              <Button
                ref={closeButton}
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full pointer-coarse:size-11"
                aria-label="Close"
              />
            }
          >
            <X />
          </SheetClose>
        </SheetHeader>
        <div className="flex flex-col items-start gap-4 px-4 py-6 sm:px-6">
          <SheetDescription className="text-sm text-muted-foreground">
            The AI assistant is turned off or not set up yet.
          </SheetDescription>
          {canManage ? (
            <Link
              ref={setUp}
              href={AI_SETTINGS_HREF}
              className={LINK_FORM}
              onClick={() => onOpenChange(false)}
            >
              Set up AI assistant
            </Link>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Composer({
  boxRef,
  draft,
  onDraft,
  onSend,
  onStop,
  busy,
  readOnly,
  screenTitle,
  fieldLabel,
  onDismissScreen,
}: {
  boxRef: RefObject<HTMLTextAreaElement | null>
  draft: string
  onDraft: (text: string) => void
  onSend: () => void
  onStop: () => void
  busy: boolean
  readOnly: boolean
  screenTitle: string | null
  fieldLabel: string | null
  onDismissScreen: () => void
}) {
  const hintId = useId()
  const canSend = !busy && !readOnly && draft.trim().length > 0
  return (
    <form
      className="shrink-0 border-t px-4 pt-3 pb-4 sm:px-6"
      onSubmit={(event) => {
        event.preventDefault()
        if (canSend) onSend()
      }}
    >
      <div className="flex flex-col gap-2">
        {readOnly ? (
          <p className="text-xs text-muted-foreground">
            You can read conversations while viewing the admin as someone else,
            but not send messages.
          </p>
        ) : null}
        {screenTitle && !readOnly ? (
          <div className="flex">
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-card py-0.5 pr-0.5 pl-2.5 text-xs">
              <FileText
                aria-hidden
                className="size-3.5 shrink-0 text-primary"
              />
              <span className="truncate">
                Using: <span className="font-medium">{screenTitle}</span>
                {fieldLabel ? (
                  <>
                    {" "}
                    · field <span className="font-medium">{fieldLabel}</span>
                  </>
                ) : null}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="rounded-full pointer-coarse:size-11"
                aria-label="Don't send this screen"
                onClick={onDismissScreen}
              >
                <X />
              </Button>
            </span>
          </div>
        ) : null}
        <div
          className={cn(
            "rounded-2xl border bg-card shadow-xs focus-within:border-primary/70 focus-within:ring-3 focus-within:ring-ring/20",
            readOnly && "opacity-60"
          )}
        >
          <textarea
            ref={boxRef}
            aria-label="Message the AI assistant"
            aria-describedby={hintId}
            placeholder="Ask for a draft, a rewrite or SEO help"
            value={draft}
            maxLength={AI_MAX_MESSAGE_CHARS}
            disabled={readOnly}
            rows={3}
            className="block w-full resize-none bg-transparent px-4 pt-3 pb-2 text-[0.9375rem] leading-6 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            onChange={(event) => onDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault()
                if (canSend) onSend()
              }
            }}
          />
          <div className="flex items-center gap-2 pr-2 pb-2 pl-4">
            <span
              id={hintId}
              className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
            >
              Enter to send, Shift+Enter for a new line
            </span>
            {busy ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full pointer-coarse:h-11"
                onClick={onStop}
              >
                <Square data-icon="inline-start" className="fill-current" />
                Stop
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon-lg"
                aria-label="Send"
                disabled={!canSend}
                className="rounded-full"
              >
                <ArrowUp />
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}

function HistoryMenu({
  activeId,
  onOpen,
  onDeletedActive,
  readOnly,
}: {
  activeId: string | null
  onOpen: (id: string) => void
  onDeletedActive: () => void
  readOnly: boolean
}) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const list = useQuery({
    queryKey: AI_CONVERSATIONS_KEY,
    queryFn: fetchConversations,
    enabled: open,
    staleTime: 0,
  })
  const remove = useMutation({
    mutationFn: deleteConversation,
    onSuccess: (_result, id) => {
      if (id === activeId) onDeletedActive()
      void queryClient.invalidateQueries({ queryKey: AI_CONVERSATIONS_KEY })
    },
    onError: (err) =>
      toast.error("Not deleted", { description: errorMessage(err) }),
  })
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full pointer-coarse:size-11"
            aria-label="Past conversations"
          />
        }
      >
        <History />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <PopoverHeader className="border-b px-4 py-3">
          <PopoverTitle>Past conversations</PopoverTitle>
        </PopoverHeader>
        <div className="max-h-80 overflow-y-auto p-1">
          {list.isPending ? (
            <p
              role="status"
              className="px-3 py-6 text-center text-sm text-muted-foreground"
            >
              Loading conversations…
            </p>
          ) : list.isError ? (
            <p role="alert" className="px-3 py-6 text-center text-sm">
              {errorMessage(list.error)}
            </p>
          ) : list.data.items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No conversations yet. They appear here after your first message.
            </p>
          ) : (
            <ul className="flex flex-col">
              {list.data.items.map((item) => (
                <li key={item.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-current={item.id === activeId ? "true" : undefined}
                    className={cn(
                      "min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:min-h-11",
                      item.id === activeId && "font-semibold"
                    )}
                    onClick={() => {
                      setOpen(false)
                      onOpen(item.id)
                    }}
                  >
                    {item.title}
                  </button>
                  {readOnly ? null : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-full pointer-coarse:size-11"
                      aria-label={`Delete “${item.title}”`}
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(item.id)}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
