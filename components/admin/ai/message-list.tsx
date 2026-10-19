"use client"

import { Copy, CornerDownLeft, Pencil, RefreshCw, Sparkles } from "lucide-react"
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { AI_MAX_MESSAGE_CHARS } from "@/lib/schemas/api/ai"

import { Markdown } from "./markdown"
import type { ChatMessage } from "./use-assistant-chat"

/**
 * The conversation: the user's messages on the right (plain text, with
 * Edit), replies on the left (safe Markdown, with Copy, Insert and, on the
 * last one, Regenerate).
 */
export function MessageList({
  messages,
  insertLabel,
  onInsert,
  canAct,
  onRegenerate,
  onEdit,
}: {
  messages: ChatMessage[]
  /** The focused field's label when a reply can be inserted into it. */
  insertLabel: string | null
  onInsert: (reply: string) => void
  /** Regenerate and Edit are offered (not busy, not read-only). */
  canAct: boolean
  onRegenerate: () => void
  onEdit: (messageId: string, text: string) => void
}) {
  const last = messages.at(-1)
  return (
    <ol className="flex flex-col gap-5">
      {messages.map((message) => (
        <li key={message.id}>
          {message.role === "user" ? (
            <UserMessage
              message={message}
              canEdit={canAct && !message.local}
              onEdit={(text) => onEdit(message.id, text)}
              canRetry={canAct && !message.local && message === last}
              onRetry={onRegenerate}
            />
          ) : (
            <Reply
              message={message}
              insertLabel={insertLabel}
              onInsert={onInsert}
              canRegenerate={canAct && message === last}
              onRegenerate={onRegenerate}
            />
          )}
        </li>
      ))}
    </ol>
  )
}

function UserMessage({
  message,
  canEdit,
  onEdit,
  canRetry,
  onRetry,
}: {
  message: ChatMessage
  canEdit: boolean
  onEdit: (text: string) => void
  /** The last message has no answer (failed): ask again. */
  canRetry: boolean
  onRetry: () => void
}) {
  const [editing, setEditing] = useState(false)
  const editButton = useRef<HTMLButtonElement>(null)
  const refocus = useRef(false)
  // Back to Edit once the box is gone (WCAG 2.4.3).
  useEffect(() => {
    if (editing || !refocus.current) return
    refocus.current = false
    editButton.current?.focus()
  }, [editing])
  const close = () => {
    refocus.current = true
    setEditing(false)
  }
  if (editing && canEdit)
    return (
      <EditBox
        initial={message.content}
        onCancel={close}
        onSave={(text) => {
          setEditing(false)
          onEdit(text)
        }}
      />
    )
  return (
    <div className="flex flex-col items-end gap-1 pl-10">
      <p className="max-w-full rounded-2xl rounded-br-md bg-primary/15 px-3.5 py-2 text-[0.9375rem] leading-relaxed wrap-break-word whitespace-pre-wrap">
        <span className="sr-only">You: </span>
        {message.content}
      </p>
      {canEdit || canRetry ? (
        <div className="flex flex-wrap items-center justify-end gap-1">
          {canRetry ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full text-muted-foreground pointer-coarse:h-11"
              onClick={onRetry}
            >
              <RefreshCw data-icon="inline-start" />
              Try again
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              ref={editButton}
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full text-muted-foreground pointer-coarse:h-11"
              onClick={() => setEditing(true)}
            >
              <Pencil data-icon="inline-start" />
              Edit
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function EditBox({
  initial,
  onSave,
  onCancel,
}: {
  initial: string
  onSave: (text: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState(initial)
  const box = useRef<HTMLTextAreaElement>(null)
  const hintId = useId()
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])
  const ok = text.trim().length > 0
  return (
    <form
      className="ml-10 flex flex-col gap-2 rounded-2xl border bg-card p-2 focus-within:border-primary/70 focus-within:ring-3 focus-within:ring-ring/20"
      onSubmit={(event) => {
        event.preventDefault()
        if (ok) onSave(text.trim())
      }}
    >
      <Textarea
        ref={box}
        aria-label="Edit your message"
        aria-describedby={hintId}
        value={text}
        maxLength={AI_MAX_MESSAGE_CHARS}
        rows={3}
        className="min-h-0 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            // Closes the editor only, not the panel.
            event.preventDefault()
            event.stopPropagation()
            onCancel()
          } else if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault()
            if (ok) onSave(text.trim())
          }
        }}
      />
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <p id={hintId} className="mr-auto px-2 text-xs text-muted-foreground">
          Replaces this message and everything after it
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-full pointer-coarse:h-11"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          className="rounded-full pointer-coarse:h-11"
          disabled={!ok}
        >
          Save &amp; resend
        </Button>
      </div>
    </form>
  )
}

function Reply({
  message,
  insertLabel,
  onInsert,
  canRegenerate,
  onRegenerate,
}: {
  message: ChatMessage
  insertLabel: string | null
  onInsert: (reply: string) => void
  canRegenerate: boolean
  onRegenerate: () => void
}) {
  const waiting = message.pending && message.content === ""
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      toast.success("Copied")
    } catch {
      toast.error("Could not copy to the clipboard")
    }
  }
  return (
    <div className="flex gap-3">
      <span
        aria-hidden
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
      >
        <Sparkles className="size-3.5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {waiting ? (
          <p className="text-sm text-muted-foreground">Thinking…</p>
        ) : (
          <div className="text-[0.9375rem]">
            <span className="sr-only">Assistant: </span>
            <Markdown text={message.content} />
          </div>
        )}
        {message.pending ? null : (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full pointer-coarse:h-11"
              onClick={() => void copy()}
            >
              <Copy data-icon="inline-start" />
              Copy
            </Button>
            {insertLabel ? (
              <Button
                type="button"
                size="sm"
                className="rounded-full pointer-coarse:h-11"
                aria-label={`Insert into ${insertLabel}`}
                onClick={() => onInsert(message.content)}
              >
                <CornerDownLeft data-icon="inline-start" />
                Insert
              </Button>
            ) : null}
            {canRegenerate ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full pointer-coarse:h-11"
                onClick={onRegenerate}
              >
                <RefreshCw data-icon="inline-start" />
                Regenerate
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
