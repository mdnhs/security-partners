import type { Metadata } from "next"
import { Suspense } from "react"

import { ChatInbox } from "@/components/admin/chat/chat-inbox"
import { requirePage } from "@/server/auth/session"

export const metadata: Metadata = { title: "Live chat" }

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  )
}

async function Screen() {
  await requirePage("/admin/chat")
  return <ChatInbox />
}
