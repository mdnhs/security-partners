"use client"

import { Copy, CornerDownLeft, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

import type { ChatMessage } from "./use-assistant-chat"

/** The conversation: the user's messages on the right, replies on the left. */
export function MessageList({
  messages,
  insertLabel,
  onInsert,
}: {
  messages: ChatMessage[]
  /** The focused field's label when a reply can be inserted into it. */
  insertLabel: string | null
  onInsert: (reply: string) => void
}) {
  return (
    <ol className="flex flex-col gap-5">
      {messages.map((message) => (
        <li key={message.id}>
          {message.role === "user" ? (
            <div className="flex justify-end pl-10">
              <p className="max-w-full rounded-2xl rounded-br-md bg-primary/15 px-3.5 py-2 text-[0.9375rem] leading-relaxed wrap-break-word whitespace-pre-wrap">
                <span className="sr-only">You: </span>
                {message.content}
              </p>
            </div>
          ) : (
            <Reply
              message={message}
              insertLabel={insertLabel}
              onInsert={onInsert}
            />
          )}
        </li>
      ))}
    </ol>
  )
}

function Reply({
  message,
  insertLabel,
  onInsert,
}: {
  message: ChatMessage
  insertLabel: string | null
  onInsert: (reply: string) => void
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
          <p role="status" className="text-sm text-muted-foreground">
            Thinking…
          </p>
        ) : (
          <p className="text-[0.9375rem] leading-relaxed wrap-break-word whitespace-pre-wrap">
            <span className="sr-only">Assistant: </span>
            {message.content}
          </p>
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
          </div>
        )}
      </div>
    </div>
  )
}
