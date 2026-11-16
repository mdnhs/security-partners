"use client"

import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import type { InferResponseType } from "hono/client"
import { toast } from "sonner"

import { api, errorMessage, unwrap } from "@/lib/api-client"

// The live chat inbox's data (port of JW admin/modules/chat/queries.ts, live
// chat plan Task 11), through the typed admin client.

const chat = api.chat

export type ChatStatus = "open" | "closed"
export type ChatPage = InferResponseType<typeof chat.$get, 200>
export type ChatListItem = ChatPage["items"][number]
export type ChatDetail = InferResponseType<(typeof chat)[":id"]["$get"], 200>
export type ChatMessage = ChatDetail["messages"][number]

export const chatKeys = {
  all: ["chat"] as const,
  lists: ["chat", "list"] as const,
  list: (status: ChatStatus) => ["chat", "list", status] as const,
  detail: (id: string) => ["chat", "detail", id] as const,
  unread: ["chat", "unread"] as const,
}

/** Lists and threads refresh every 4 s in view, every 30 s behind another tab. */
export const pollInterval = (visible: boolean) => (visible ? 4_000 : 30_000)

export const chatListQuery = (status: ChatStatus, visible = true) =>
  infiniteQueryOptions({
    queryKey: chatKeys.list(status),
    queryFn: ({ pageParam }) =>
      unwrap(
        chat.$get({
          query: { status, ...(pageParam ? { cursor: pageParam } : {}) },
        })
      ),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: pollInterval(visible),
    refetchIntervalInBackground: true,
  })

export const chatDetailQuery = (id: string, visible = true) =>
  queryOptions({
    queryKey: chatKeys.detail(id),
    // Asks only for messages newer than the ones already held, and appends.
    queryFn: async ({ client }): Promise<ChatDetail> => {
      const prev = client.getQueryData<ChatDetail>(chatKeys.detail(id))
      const after = prev?.messages.at(-1)?.id ?? 0
      const next = await unwrap(
        chat[":id"].$get({ param: { id }, query: { after: String(after) } })
      )
      const held = prev?.messages ?? []
      const seen = new Set(held.map((m) => m.id))
      return {
        ...next,
        messages: [...held, ...next.messages.filter((m) => !seen.has(m.id))],
      }
    },
    refetchInterval: pollInterval(visible),
    refetchIntervalInBackground: true,
  })

export const chatUnreadQuery = (enabled: boolean, initial?: number) =>
  queryOptions({
    queryKey: chatKeys.unread,
    queryFn: () => unwrap(chat.unread.$get()),
    enabled,
    initialData: initial === undefined ? undefined : { count: initial },
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  })

const toastError = (error: unknown) => {
  toast.error(errorMessage(error))
}

export function useChatActions(id: string) {
  const client = useQueryClient()
  const refreshLists = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: chatKeys.lists }),
      client.invalidateQueries({ queryKey: chatKeys.unread }),
    ])
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: chatKeys.detail(id) }),
      refreshLists(),
    ])
  const opts = { onSuccess: refresh, onError: toastError }
  const param = { id }
  return {
    takeover: useMutation({
      mutationFn: () => unwrap(chat[":id"].takeover.$post({ param })),
      ...opts,
    }),
    handback: useMutation({
      mutationFn: () => unwrap(chat[":id"].handback.$post({ param })),
      ...opts,
    }),
    assign: useMutation({
      mutationFn: (userId: string | null) =>
        unwrap(chat[":id"].assign.$post({ param, json: { userId } })),
      ...opts,
    }),
    close: useMutation({
      mutationFn: () => unwrap(chat[":id"].close.$post({ param })),
      ...opts,
    }),
    remove: useMutation({
      mutationFn: () => unwrap(chat[":id"].$delete({ param })),
      onSuccess: () => {
        client.removeQueries({ queryKey: chatKeys.detail(id) })
        return refreshLists()
      },
      onError: toastError,
    }),
    // The server also takes the chat over for the sender. The thread shows
    // the error inline and keeps the draft, so there is no toast here.
    reply: useMutation({
      mutationFn: (body: string) =>
        unwrap(chat[":id"].messages.$post({ param, json: { body } })),
      onSuccess: refresh,
    }),
    // Only called while the tab is visible; failures are silent and retried
    // on the next new message.
    markRead: useMutation({
      mutationFn: (upTo: number) =>
        unwrap(chat[":id"].read.$post({ param, json: { upTo } })),
      onSuccess: refreshLists,
    }),
  }
}
