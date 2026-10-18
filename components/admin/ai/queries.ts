import { api, unwrap } from "@/lib/api-client"
import type {
  AiConversationDto,
  AiConversationSummary,
  AiStatusDto,
} from "@/lib/schemas/api/ai"
import type { Paginated } from "@/lib/schemas/api/list"

export const AI_STATUS_KEY = ["ai", "status"] as const
export const AI_CONVERSATIONS_KEY = ["ai", "conversations"] as const

export async function fetchAiStatus(): Promise<AiStatusDto> {
  return (await unwrap(api.ai.status.$get())) as AiStatusDto
}

/** The 20 most recently used conversations. */
export async function fetchConversations(): Promise<
  Paginated<AiConversationSummary>
> {
  return (await unwrap(
    api.ai.conversations.$get({ query: { pageSize: "20" } })
  )) as Paginated<AiConversationSummary>
}

export async function fetchConversation(
  id: string
): Promise<AiConversationDto> {
  return (await unwrap(
    api.ai.conversations[":id"].$get({ param: { id } })
  )) as AiConversationDto
}

export async function deleteConversation(id: string): Promise<{ ok: true }> {
  return (await unwrap(
    api.ai.conversations[":id"].$delete({ param: { id } })
  )) as { ok: true }
}
