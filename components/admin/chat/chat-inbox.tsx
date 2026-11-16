"use client"

import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import {
  Archive,
  Bot,
  ChevronDown,
  Hand,
  type LucideIcon,
  MessageCircle,
  MessagesSquare,
  MousePointerClick,
  Settings,
  UserCheck,
} from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { type ReactNode, useEffect, useState } from "react"

import {
  mergeListSearch,
  replaceListSearch,
} from "@/components/admin/data-table/list-url"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { StatusPill, type StatusTone } from "@/components/admin/kit/status-pill"
import { LINK_SECONDARY, PageHeader } from "@/components/admin/page-header"
import { useAdminSession } from "@/components/admin/session-provider"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePermission } from "@/hooks/use-permission"
import { errorMessage } from "@/lib/api-client"
import { isUuid } from "@/lib/ids"
import { cn } from "@/lib/utils"

import { ChatThread } from "./chat-thread"
import { formatMessageTime, useTabVisible } from "./present"
import { PrivacyRequestDialog } from "./privacy-request-dialog"
import {
  type ChatListItem,
  type ChatStatus,
  chatListQuery,
  chatUnreadQuery,
} from "./queries"

type InboxParams = { c: string | null; status: ChatStatus }

function parseInbox(search: string): InboxParams {
  const params = new URLSearchParams(search)
  const c = params.get("c")
  return {
    c: isUuid(c) ? c.toLowerCase() : null,
    status: params.get("status") === "closed" ? "closed" : "open",
  }
}

/**
 * `?c=<uuid>&status=closed` (open is the default and left out). Our own
 * writes show at once; a link that changes the URL is followed.
 */
function useInboxParams(): [
  InboxParams,
  (patch: Partial<InboxParams>) => void,
] {
  const searchParams = useSearchParams()
  const url = searchParams?.toString() ?? ""
  const [search, setSearch] = useState(url)
  const [seenUrl, setSeenUrl] = useState(url)
  if (seenUrl !== url) {
    setSeenUrl(url)
    setSearch(url)
  }
  const update = (patch: Partial<InboxParams>) => {
    const changes: Record<string, string | undefined> = {}
    if ("c" in patch) changes.c = patch.c ?? undefined
    if ("status" in patch)
      changes.status = patch.status === "closed" ? "closed" : undefined
    const next = mergeListSearch(window.location.search, changes, {
      keepPage: true,
    })
    setSearch(next)
    replaceListSearch(next)
  }
  return [parseInbox(search), update]
}

function Pill({
  tone,
  icon: Icon,
  children,
}: {
  tone: StatusTone
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <StatusPill tone={tone} className="h-6 gap-1 px-2">
      <Icon aria-hidden className="size-3.5" />
      {children}
    </StatusPill>
  )
}

function Row({
  chat,
  selected,
  mine,
  onSelect,
}: {
  chat: ChatListItem
  selected: boolean
  mine: boolean
  onSelect: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex w-full flex-col gap-1 border-b px-3 py-2.5 text-left outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
          selected && "bg-muted"
        )}
      >
        <span className="flex items-center gap-2">
          {chat.unread ? (
            <span
              role="img"
              aria-label="Unread"
              className="size-2 shrink-0 rounded-full bg-primary"
            />
          ) : null}
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm",
              chat.unread ? "font-semibold" : "font-medium"
            )}
          >
            {chat.visitorName}
          </span>
          <time
            dateTime={chat.lastMessageAt}
            className="shrink-0 text-xs text-muted-foreground"
          >
            {formatMessageTime(chat.lastMessageAt)}
          </time>
        </span>
        <span className="flex flex-wrap gap-1">
          {chat.needsHuman ? (
            <Pill tone="danger" icon={Hand}>
              Needs a person
            </Pill>
          ) : null}
          {chat.status === "open" && chat.aiEnabled ? (
            <Pill tone="info" icon={Bot}>
              AI
            </Pill>
          ) : null}
          {chat.assignedTo ? (
            <Pill tone="neutral" icon={UserCheck}>
              {mine ? "Assigned to you" : "Assigned"}
            </Pill>
          ) : null}
        </span>
      </button>
    </li>
  )
}

function RowsSkeleton() {
  return (
    <div role="status" className="flex flex-col">
      <span className="sr-only">Loading chats…</span>
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          aria-hidden
          className="flex flex-col gap-2 border-b p-3"
        >
          <Skeleton className="bg-skeleton h-4 w-2/3" />
          <Skeleton className="bg-skeleton h-3 w-1/3" />
        </div>
      ))}
    </div>
  )
}

/**
 * The live chat inbox (JW chat-inbox.tsx, live chat plan Task 11): open and
 * closed chats on the left, the picked conversation on the right. Lists and
 * threads poll (C1); the tab title carries the unread count.
 */
export function ChatInbox() {
  const visible = useTabVisible()
  const { user } = useAdminSession()
  const canManage = usePermission({ chat: ["manage"] })
  const canSettings = usePermission({ settings: ["read"] })
  const [{ c: selected, status }, setParams] = useInboxParams()
  const list = useInfiniteQuery(chatListQuery(status, visible))
  const unread = useQuery(chatUnreadQuery(true)).data?.count ?? 0
  const items = list.data?.pages.flatMap((page) => page.items) ?? []

  useEffect(() => {
    const previous = document.title
    return () => {
      document.title = previous
    }
  }, [])
  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) Live chat` : "Live chat"
  }, [unread])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-0"
        title="Live chat"
        description="Conversations from the site's chat bubble."
        actions={
          canSettings || canManage ? (
            <>
              {canSettings ? (
                <Link href="/admin/settings/chat" className={LINK_SECONDARY}>
                  <Settings aria-hidden />
                  Chat settings
                </Link>
              ) : null}
              {canManage ? <PrivacyRequestDialog /> : null}
            </>
          ) : undefined
        }
      />
      <div className="rounded-card grid h-[calc(var(--content-h)-10rem)] min-h-96 overflow-hidden border bg-card lg:grid-cols-[22rem_1fr]">
        <section
          aria-label="Chats"
          className={cn(
            "min-h-0 flex-col border-r",
            selected ? "hidden lg:flex" : "flex"
          )}
        >
          <div className="border-b p-3">
            <Tabs
              value={status}
              onValueChange={(next) =>
                setParams({ status: next as ChatStatus, c: null })
              }
            >
              <TabsList>
                <TabsTrigger value="open">
                  <MessageCircle aria-hidden />
                  Open
                </TabsTrigger>
                <TabsTrigger value="closed">
                  <Archive aria-hidden />
                  Closed
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {list.isPending ? (
              <RowsSkeleton />
            ) : list.isError ? (
              <div role="alert" className="flex flex-col items-start gap-3 p-4">
                <p className="text-sm">{errorMessage(list.error)}</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void list.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : items.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={MessagesSquare}
                  title={
                    status === "open" ? "No open chats" : "No closed chats"
                  }
                  description="New conversations appear here."
                />
              </div>
            ) : (
              <ul>
                {items.map((chat) => (
                  <Row
                    key={chat.id}
                    chat={chat}
                    selected={chat.id === selected}
                    mine={chat.assignedTo === user.id}
                    onSelect={() => setParams({ c: chat.id })}
                  />
                ))}
              </ul>
            )}
            {list.hasNextPage ? (
              <div className="p-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={list.isFetchingNextPage}
                  onClick={() => void list.fetchNextPage()}
                >
                  <ChevronDown data-icon="inline-start" aria-hidden />
                  Load more
                </Button>
              </div>
            ) : null}
          </div>
        </section>
        <section
          aria-label="Conversation"
          className={cn("min-h-0", selected ? "block" : "hidden lg:block")}
        >
          {selected ? (
            <ChatThread
              key={selected}
              id={selected}
              onBack={() => setParams({ c: null })}
              onGone={() => setParams({ c: null })}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
              <MousePointerClick aria-hidden className="size-6" />
              Pick a chat to read it.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
