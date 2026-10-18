"use client"

import { useQuery } from "@tanstack/react-query"
import { Sparkles } from "lucide-react"
import { useCallback, useRef, useState } from "react"

import { ICON_BUTTON } from "@/components/admin/shell/constants"
import { Button } from "@/components/ui/button"
import type { AiStatusDto } from "@/lib/schemas/api/ai"

import { AssistantPanel } from "./assistant-panel"
import { AI_STATUS_KEY, fetchAiStatus } from "./queries"
import { useAssistantChat } from "./use-assistant-chat"
import { useAssistantHotkey } from "./use-assistant-hotkey"

/**
 * Topbar entry to the AI assistant (spec §8.3; JW `AiAssistant`): hidden
 * unless it is on and allowed for this user. The status arrives from the
 * panel layout and is refetched when Settings ▸ Integrations changes it.
 */
export function AssistantButton({
  initialStatus,
}: {
  initialStatus?: AiStatusDto
}) {
  const status = useQuery({
    queryKey: AI_STATUS_KEY,
    queryFn: fetchAiStatus,
    initialData: initialStatus,
    staleTime: 60_000,
    enabled: initialStatus !== undefined,
  })
  const chat = useAssistantChat()
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const available = status.data?.available === true
  const toggle = useCallback(() => setOpen((value) => !value), [])
  useAssistantHotkey(available, toggle)

  if (!available || !status.data) return null
  return (
    <>
      <Button
        ref={trigger}
        type="button"
        variant="outline"
        size="icon-lg"
        className={ICON_BUTTON}
        aria-label="AI assistant"
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+J Control+J"
        onClick={() => setOpen(true)}
      >
        <Sparkles aria-hidden />
      </Button>
      <AssistantPanel
        open={open}
        onOpenChange={setOpen}
        status={status.data}
        chat={chat}
        trigger={trigger}
      />
    </>
  )
}
