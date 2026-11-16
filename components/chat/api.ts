import {
  CHAT_PUBLIC_ENDPOINT,
  type ChatStatus,
  type StartChatInput,
  type VisitorView,
} from "@/lib/schemas/api/chat"

// Port of JW features/chat/api.ts. Failures become kinds by HTTP status only:
// the server's English message is never read, so the panel shows settings
// copy for every kind.

export type ApiFailure =
  | { ok: false; kind: "network" }
  | { ok: false; kind: "notfound" }
  | { ok: false; kind: "ended" }
  | { ok: false; kind: "rate" }
  | { ok: false; kind: "invalid"; fieldErrors: Record<string, string[]> }
  | { ok: false; kind: "other" }
export type ApiResult<T> = { ok: true; data: T } | ApiFailure

type ErrorBody = { error?: { fieldErrors?: Record<string, string[]> } }

/** A hung request must not stall polling: it fails as `network` instead. */
const TIMEOUT_MS = 10_000

async function call<T>(
  path: string,
  init?: { method: "POST"; body: unknown }
): Promise<ApiResult<T>> {
  let res: Response
  try {
    res = await fetch(`${CHAT_PUBLIC_ENDPOINT}${path}`, {
      method: init?.method ?? "GET",
      headers: init ? { "content-type": "application/json" } : undefined,
      body: init ? JSON.stringify(init.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    // Offline, or the timeout aborted it.
    return { ok: false, kind: "network" }
  }
  if (res.ok) {
    try {
      return { ok: true, data: (await res.json()) as T }
    } catch {
      return { ok: false, kind: "other" }
    }
  }
  if (res.status === 404) return { ok: false, kind: "notfound" }
  if (res.status === 409) return { ok: false, kind: "ended" }
  if (res.status === 429) return { ok: false, kind: "rate" }
  if (res.status >= 500) return { ok: false, kind: "network" }
  if (res.status === 400 || res.status === 422) {
    const body = (await res.json().catch(() => null)) as ErrorBody | null
    return {
      ok: false,
      kind: "invalid",
      fieldErrors: body?.error?.fieldErrors ?? {},
    }
  }
  return { ok: false, kind: "other" }
}

export const getStatus = () => call<ChatStatus>("/status")

export const getConversation = (after: number) =>
  call<VisitorView>(
    after > 0 ? `/conversation?after=${after}` : "/conversation"
  )

// The honeypot path answers `{ ok: true }` with no chat; callers check `id`.
export const startChat = (input: StartChatInput) =>
  call<VisitorView | { ok: true }>("/start", { method: "POST", body: input })

export const sendMessage = (body: string) =>
  call<{ ok: true; id: number }>("/messages", {
    method: "POST",
    body: { body },
  })

export const saveEmail = (email: string) =>
  call<{ ok: true }>("/email", { method: "POST", body: { email } })
