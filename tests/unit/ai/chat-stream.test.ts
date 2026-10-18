import { describe, expect, it } from "vitest"

import {
  type ChatStreamEvent,
  encodeChatEvent,
  parseChatEvent,
  readChatStream,
} from "@/lib/ai/chat-stream"

const encoder = new TextEncoder()

function streamOf(...chunks: Uint8Array[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
  })
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const events: ChatStreamEvent[] = []
  for await (const event of readChatStream(stream)) events.push(event)
  return events
}

describe("chat stream (NDJSON)", () => {
  it("encodes one event per line", () => {
    expect(encodeChatEvent({ type: "text", text: "a\nb" })).toBe(
      '{"type":"text","text":"a\\nb"}\n'
    )
  })

  it("reads events split across chunks, including multi-byte characters", async () => {
    const line = encoder.encode(
      encodeChatEvent({ type: "text", text: "Dinn Rí – “quoted”" })
    )
    const cut = line.indexOf(0xc3) + 1 // inside "í"
    const events = await collect(
      streamOf(
        encoder.encode(
          encodeChatEvent({ type: "start", conversationId: "c1" })
        ),
        line.slice(0, cut),
        line.slice(cut),
        // The last event may arrive without its newline.
        encoder.encode('{"type":"done","messageId":"m1"}')
      )
    )
    expect(events).toEqual([
      { type: "start", conversationId: "c1" },
      { type: "text", text: "Dinn Rí – “quoted”" },
      { type: "done", messageId: "m1" },
    ])
  })

  it("skips blank, broken and unknown lines", async () => {
    const events = await collect(
      streamOf(
        encoder.encode(
          '\n{"type":"text","text":"ok"}\nnot json\n{"type":"nope"}\n{"type":"text","text":5}\n{"type":"error","message":"Failed"}\n'
        )
      )
    )
    expect(events).toEqual([
      { type: "text", text: "ok" },
      { type: "error", message: "Failed" },
    ])
    expect(parseChatEvent("")).toBeNull()
    expect(parseChatEvent("null")).toBeNull()
    expect(parseChatEvent('{"type":"start"}')).toBeNull()
  })
})
