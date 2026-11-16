"use client"

import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeft,
  Bot,
  CircleCheck,
  Hand,
  type LucideIcon,
  Send,
  Trash2,
  UserCheck,
  UserMinus,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { COARSE_ICON } from "@/components/admin/page-header"
import { useAdminSession } from "@/components/admin/session-provider"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { usePermission } from "@/hooks/use-permission"
import { errorMessage } from "@/lib/api-client"
import { cn } from "@/lib/utils"

import { formatMessageTime, useTabVisible } from "./present"
import { type ChatMessage, chatDetailQuery, useChatActions } from "./queries"

/** An icon-only action with its name as a tooltip (JW TipButton). */
function TipButton({
  label,
  icon: Icon,
  danger = false,
  disabled,
  onClick,
}: {
  label: string
  icon: LucideIcon
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className={cn(
              COARSE_ICON,
              danger && "text-destructive hover:text-destructive"
            )}
          />
        }
      >
        <Icon aria-hidden />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function Bubble({
  message,
  visitor,
}: {
  message: ChatMessage
  visitor: string
}) {
  if (message.sender === "system") {
    return (
      <p className="py-1 text-center text-xs text-muted-foreground">
        {message.body}
      </p>
    )
  }
  const mine = message.sender !== "visitor"
  const who =
    message.sender === "visitor"
      ? visitor
      : message.sender === "ai"
        ? (message.senderName ?? "Assistant")
        : (message.senderName ?? "Team")
  return (
    <div className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
      <div className="mb-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>{who}</span>
        {message.sender === "ai" ? (
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
            AI
          </Badge>
        ) : null}
        <time dateTime={message.createdAt}>
          {formatMessageTime(message.createdAt)}
        </time>
      </div>
      {/* Plain text only: no markdown, no links, whatever the author wrote. */}
      <p
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap",
          mine ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {message.body}
      </p>
    </div>
  )
}

function ThreadSkeleton() {
  return (
    <div role="status" className="flex h-full flex-col gap-4 p-4">
      <span className="sr-only">Loading the chat…</span>
      <Skeleton aria-hidden className="bg-skeleton h-10 w-1/2" />
      <Skeleton aria-hidden className="bg-skeleton h-14 w-2/3" />
      <Skeleton aria-hidden className="bg-skeleton ml-auto h-14 w-2/3" />
    </div>
  )
}

/**
 * One conversation (JW chat-thread.tsx): who it is with, the actions the
 * user may take, the messages and the reply box. The inbox keys it by chat
 * id, so each chat starts with an empty composer and a fresh read marker.
 */
export function ChatThread({
  id,
  onBack,
  onGone,
}: {
  id: string
  onBack: () => void
  onGone: () => void
}) {
  const visible = useTabVisible()
  const { user } = useAdminSession()
  const canReply = usePermission({ chat: ["reply"] })
  const canManage = usePermission({ chat: ["manage"] })
  const detail = useQuery(chatDetailQuery(id, visible))
  const actions = useChatActions(id)
  const [draft, setDraft] = useState("")
  const [sendError, setSendError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const marked = useRef(0)

  const chat = detail.data?.chat
  const messages = detail.data?.messages
  const newest = messages?.at(-1)?.id ?? 0
  const closed = chat?.status === "closed"

  const ready = Boolean(chat) && !closed && canReply
  useEffect(() => {
    if (ready) box.current?.focus()
  }, [id, ready])

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [newest])

  // Read receipts only count while the tab is in view.
  const { mutate: markRead } = actions.markRead
  useEffect(() => {
    if (!visible || document.hidden || newest <= marked.current) return
    marked.current = newest
    markRead(newest)
  }, [visible, newest, markRead])

  if (detail.isPending) return <ThreadSkeleton />
  if (detail.isError || !chat) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 p-6">
        <p className="text-sm">
          {detail.isError
            ? errorMessage(detail.error)
            : "Couldn't load this chat."}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void detail.refetch()}
        >
          Try again
        </Button>
      </div>
    )
  }

  const mineAssigned = chat.assignedTo === user.id
  const send = () => {
    const body = draft.trim()
    if (!body || actions.reply.isPending) return
    setSendError(null)
    actions.reply.mutate(body, {
      onSuccess: () => setDraft(""),
      onError: (error) => setSendError(errorMessage(error)),
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b p-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn("lg:hidden", COARSE_ICON)}
          aria-label="Back to chats"
          onClick={onBack}
        >
          <ArrowLeft aria-hidden />
        </Button>
        <div className="mr-auto min-w-0">
          <h2 className="truncate text-sm font-semibold">{chat.visitorName}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {[
              chat.visitorEmail,
              detail.data.assigneeName
                ? `With ${detail.data.assigneeName}`
                : chat.aiEnabled
                  ? "AI is replying"
                  : null,
              closed ? "Ended" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {canReply && !closed ? (
          chat.aiEnabled ? (
            <Button
              type="button"
              size="sm"
              disabled={actions.takeover.isPending}
              onClick={() => actions.takeover.mutate()}
            >
              <Hand data-icon="inline-start" aria-hidden />
              Take over
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={actions.handback.isPending}
              onClick={() => actions.handback.mutate()}
            >
              <Bot data-icon="inline-start" aria-hidden />
              Hand back to AI
            </Button>
          )
        ) : null}
        {canManage && !closed ? (
          <TipButton
            label={mineAssigned ? "Unassign" : "Assign to me"}
            icon={mineAssigned ? UserMinus : UserCheck}
            disabled={actions.assign.isPending}
            onClick={() => actions.assign.mutate(mineAssigned ? null : user.id)}
          />
        ) : null}
        {canReply && !closed ? (
          <TipButton
            label="Close"
            icon={CircleCheck}
            disabled={actions.close.isPending}
            onClick={() => actions.close.mutate()}
          />
        ) : null}
        {canManage ? (
          <TipButton
            label="Delete"
            icon={Trash2}
            danger
            onClick={() => setConfirmDelete(true)}
          />
        ) : null}
      </header>

      <div
        ref={scroller}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
      >
        {messages?.map((m) => (
          <Bubble key={m.id} message={m} visitor={chat.visitorName} />
        ))}
      </div>

      <footer className="border-t p-3">
        {sendError ? (
          <p role="alert" className="mb-2 text-sm text-destructive">
            {sendError}
          </p>
        ) : null}
        {closed ? (
          <p className="text-sm text-muted-foreground">This chat has ended.</p>
        ) : canReply ? (
          <div className="flex items-end gap-2">
            <Textarea
              ref={box}
              aria-label="Reply"
              rows={2}
              maxLength={2000}
              placeholder="Write a reply. Sending also takes over from the AI."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            <Button
              type="button"
              disabled={!draft.trim() || actions.reply.isPending}
              onClick={send}
            >
              <Send data-icon="inline-start" aria-hidden />
              Send
            </Button>
          </div>
        ) : null}
      </footer>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(next) => {
          if (!next) setConfirmDelete(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              The whole conversation with {chat.visitorName} is removed for
              good. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={actions.remove.isPending}
              onClick={() =>
                actions.remove.mutate(undefined, {
                  onSuccess: () => {
                    setConfirmDelete(false)
                    onGone()
                  },
                })
              }
            >
              Delete chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
