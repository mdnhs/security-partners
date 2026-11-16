import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// The inbox writes the URL with the native history API (Next keeps
// useSearchParams in sync with it): read the live address.
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react")
  const subscribe = (onChange: () => void) => {
    window.addEventListener("popstate", onChange)
    return () => window.removeEventListener("popstate", onChange)
  }
  let router: unknown = null
  return {
    usePathname: () => "/admin/chat",
    useRouter: () =>
      (router ??= { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
    useSearchParams: () =>
      new URLSearchParams(
        useSyncExternalStore(
          subscribe,
          () => window.location.search,
          () => ""
        )
      ),
  }
})

import { ChatInbox } from "@/components/admin/chat/chat-inbox"
import { formatMessageTime } from "@/components/admin/chat/present"
import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { NavBadges } from "@/lib/admin/nav"
import type { Role } from "@/lib/auth/roles"

// Port of JW admin/modules/chat/chat-inbox.test.tsx (live chat plan Task 11).

const A = "0190a6e0-0000-7000-8000-0000000000a1"
const B = "0190a6e0-0000-7000-8000-0000000000b2"

const chatRow = (over: Record<string, unknown> = {}) => ({
  id: A,
  status: "open",
  aiEnabled: true,
  needsHuman: true,
  assignedTo: null as string | null,
  visitorName: "Visitor",
  visitorEmail: "ann@example.com",
  sourcePath: "/",
  aiReplyCount: 1,
  messageCount: 3,
  lastMessageAt: new Date().toISOString(),
  unread: true,
  ...over,
})

type Msg = {
  id: number
  sender: string
  senderName: string | null
  body: string
  createdAt: string
}

let state: {
  open: ReturnType<typeof chatRow>[]
  closed: ReturnType<typeof chatRow>[]
  detail: ReturnType<typeof chatRow>
  messages: Msg[]
  unread: number
  replyStatus: number
}
let calls: { url: string; method: string; body?: string }[] = []

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  })

beforeEach(() => {
  calls = []
  const now = new Date().toISOString()
  state = {
    open: [
      chatRow(),
      chatRow({
        id: B,
        visitorName: "Bob",
        unread: false,
        needsHuman: false,
        aiEnabled: false,
        assignedTo: "u1",
      }),
    ],
    closed: [],
    detail: chatRow(),
    messages: [
      {
        id: 1,
        sender: "visitor",
        senderName: null,
        body: "Hi <b>there</b> https://x.test",
        createdAt: now,
      },
      {
        id: 2,
        sender: "ai",
        senderName: "Assistant",
        body: "Hello, **how** can I help?",
        createdAt: now,
      },
    ],
    unread: 2,
    replyStatus: 201,
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = input instanceof Request ? input : null
      const url = req ? req.url : String(input)
      const method = init?.method ?? req?.method ?? "GET"
      const body =
        typeof init?.body === "string"
          ? init.body
          : req && method !== "GET"
            ? await req.clone().text()
            : undefined
      calls.push({ url, method, body })
      const { pathname, searchParams } = new URL(url, "http://x")
      const path = pathname.replace(/^\/api\/v1\/admin\/chat/, "")
      if (path === "/unread") return json({ count: state.unread })
      if (path === "/export")
        return json({ chats: [] }, 200, {
          "content-disposition": 'attachment; filename="chats-ann.json"',
        })
      if (path === "/erase") return json({ erased: 2 })
      if (path === "" || path === "/")
        return json({
          items:
            searchParams.get("status") === "closed" ? state.closed : state.open,
          nextCursor: null,
        })
      if (path.endsWith("/messages"))
        return state.replyStatus === 201
          ? json(
              {
                id: 9,
                sender: "staff",
                senderName: "Ian",
                body: "ok",
                createdAt: now,
              },
              201
            )
          : json(
              {
                error: {
                  code: "CONFLICT",
                  message: "Someone else is handling this chat",
                },
              },
              state.replyStatus
            )
      if (method !== "GET") return json({ ok: true, chat: state.detail })
      return json({
        chat: state.detail,
        assigneeName: null,
        messages: state.messages,
      })
    })
  )
})

function Shell({
  roles,
  badges,
  children,
}: {
  roles: Role[]
  badges?: NavBadges
  children?: ReactNode
}) {
  return (
    <AdminShell
      queryClient={makeQueryClient()}
      site={{ url: "http://localhost:3000", env: "development" }}
      badges={badges}
      session={{
        user: {
          id: "u1",
          name: "Ian Intake",
          email: "ian@x.test",
          title: null,
          twoFactorEnabled: true,
        },
        roles,
        impersonatedBy: null,
      }}
    >
      {children}
    </AdminShell>
  )
}

function renderInbox(roles: Role[], search = "") {
  window.history.replaceState(null, "", `/admin/chat${search}`)
  return render(
    <Shell roles={roles}>
      <ChatInbox />
    </Shell>
  )
}

const posted = (suffix: string) =>
  calls.some(
    (c) =>
      c.method === "POST" &&
      new URL(c.url, "http://x").pathname.endsWith(suffix)
  )

describe("live chat inbox", () => {
  it("lists open chats with pills and selects one into ?c=", async () => {
    const user = userEvent.setup()
    renderInbox(["intake"])
    const chats = await screen.findByRole("region", { name: "Chats" })
    const first = await within(chats).findByRole("button", { name: /Visitor/ })
    expect(within(first).getByText("Needs a person")).toBeInTheDocument()
    expect(within(first).getByText("AI")).toBeInTheDocument()
    expect(within(first).getByRole("img", { name: "Unread" })).toBeVisible()
    const bob = within(chats).getByRole("button", { name: /Bob/ })
    expect(within(bob).getByText("Assigned to you")).toBeInTheDocument()
    expect(within(bob).queryByText("AI")).toBeNull()
    expect(screen.getByText("Pick a chat to read it.")).toBeInTheDocument()

    await user.click(first)
    expect(new URLSearchParams(window.location.search).get("c")).toBe(A)
    expect(first).toHaveAttribute("aria-current", "true")
    // Plain text: no markup, no links, in the thread.
    expect(
      await screen.findByText("Hi <b>there</b> https://x.test")
    ).toBeInTheDocument()
    expect(screen.getByText("Hello, **how** can I help?")).toBeInTheDocument()
    expect(document.querySelector("a[href='https://x.test']")).toBeNull()
    expect(screen.getByText("ann@example.com · AI is replying")).toBeVisible()
  })

  it("ignores a ?c= that is not a chat id", async () => {
    renderInbox(["intake"], "?c=../../users")
    expect(
      await screen.findByText("Pick a chat to read it.")
    ).toBeInTheDocument()
    expect(calls.some((c) => c.url.includes("users"))).toBe(false)
  })

  it("switching to Closed clears the selection", async () => {
    const user = userEvent.setup()
    renderInbox(["intake"], `?c=${A}`)
    await screen.findByRole("button", { name: "Take over" })
    await user.click(screen.getByRole("tab", { name: "Closed" }))
    const params = new URLSearchParams(window.location.search)
    expect(params.get("c")).toBeNull()
    expect(params.get("status")).toBe("closed")
    expect(await screen.findByText("No closed chats")).toBeInTheDocument()
    expect(screen.getByText("New conversations appear here.")).toBeVisible()
    expect(screen.queryByRole("button", { name: "Take over" })).toBeNull()
    expect(calls.some((c) => c.url.includes("/chat?status=closed"))).toBe(true)
  })

  it("Take over and Hand back to AI call the API", async () => {
    const user = userEvent.setup()
    renderInbox(["intake"], `?c=${A}`)
    await user.click(await screen.findByRole("button", { name: "Take over" }))
    await waitFor(() => expect(posted(`/${A}/takeover`)).toBe(true))
  })

  it("reply shows inline error and keeps the draft", async () => {
    const user = userEvent.setup()
    state.replyStatus = 409
    renderInbox(["intake"], `?c=${A}`)
    const box = await screen.findByRole("textbox", { name: "Reply" })
    expect(box).toHaveAttribute(
      "placeholder",
      "Write a reply. Sending also takes over from the AI."
    )
    expect(box).toHaveAttribute("maxlength", "2000")
    await user.type(box, "Hello Ann")
    await user.click(screen.getByRole("button", { name: "Send" }))
    const alert = await screen.findByText("Someone else is handling this chat")
    expect(alert).toHaveAttribute("role", "alert")
    expect(box).toHaveValue("Hello Ann")
    expect(
      JSON.parse(calls.find((c) => c.url.endsWith("/messages"))!.body!)
    ).toEqual({ body: "Hello Ann" })

    // Enter sends too; a success clears the draft.
    state.replyStatus = 201
    await user.type(box, "{Enter}")
    await waitFor(() => expect(box).toHaveValue(""))
  })

  it("intake sees no Assign or Delete; an owner does", async () => {
    const first = renderInbox(["intake"], `?c=${A}`)
    await screen.findByRole("button", { name: "Take over" })
    const thread = screen.getByRole("region", { name: "Conversation" })
    expect(within(thread).getByRole("button", { name: "Close" })).toBeVisible()
    expect(within(thread).queryByRole("button", { name: /Assign/ })).toBeNull()
    expect(within(thread).queryByRole("button", { name: "Delete" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Privacy request" })).toBeNull()
    expect(screen.queryByRole("link", { name: "Chat settings" })).toBeNull()
    first.unmount()

    const user = userEvent.setup()
    renderInbox(["owner"], `?c=${A}`)
    await user.click(
      await screen.findByRole("button", { name: "Assign to me" })
    )
    await waitFor(() => expect(posted(`/${A}/assign`)).toBe(true))
    expect(screen.getByRole("link", { name: "Chat settings" })).toHaveAttribute(
      "href",
      "/admin/settings/chat"
    )
    await user.click(screen.getByRole("button", { name: "Delete" }))
    const dialog = await screen.findByRole("alertdialog", {
      name: "Delete this chat?",
    })
    expect(dialog).toHaveTextContent(
      "The whole conversation with Visitor is removed for good. This can't be undone."
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Delete chat" })
    )
    await waitFor(() =>
      expect(
        calls.some((c) => c.method === "DELETE" && c.url.endsWith(`/${A}`))
      ).toBe(true)
    )
    await waitFor(() =>
      expect(new URLSearchParams(window.location.search).get("c")).toBeNull()
    )
  })

  it("marks read while visible but not while the tab is hidden", async () => {
    const first = renderInbox(["intake"], `?c=${A}`)
    await waitFor(() => expect(posted(`/${A}/read`)).toBe(true))
    expect(
      JSON.parse(calls.find((c) => c.url.endsWith("/read"))!.body!)
    ).toEqual({ upTo: 2 })
    first.unmount()
    calls = []
    Object.defineProperty(document, "hidden", {
      value: true,
      configurable: true,
    })
    try {
      renderInbox(["intake"], `?c=${A}`)
      await screen.findByText("Hello, **how** can I help?")
      expect(posted("/read")).toBe(false)
    } finally {
      Reflect.deleteProperty(document, "hidden")
    }
  })

  it("title shows (2) Live chat and is restored on unmount", async () => {
    document.title = "Admin"
    const view = renderInbox(["intake"])
    await waitFor(() => expect(document.title).toBe("(2) Live chat"))
    view.unmount()
    expect(document.title).toBe("Admin")
  })

  it("privacy request downloads and erases after confirm", async () => {
    const user = userEvent.setup()
    const saved: string[] = []
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:chats"),
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      saved.push(this.download)
    })
    renderInbox(["owner"])
    await user.click(
      await screen.findByRole("button", { name: "Privacy request" })
    )
    const dialog = await screen.findByRole("dialog", {
      name: "Privacy request",
    })
    const email = within(dialog).getByLabelText("Email")

    await user.click(
      within(dialog).getByRole("button", { name: "Download chats" })
    )
    expect(
      within(dialog).getByText("Enter a valid email address.")
    ).toBeVisible()
    expect(calls.some((c) => c.url.includes("/export"))).toBe(false)

    await user.type(email, "Ann@Example.com")
    await user.click(
      within(dialog).getByRole("button", { name: "Download chats" })
    )
    await waitFor(() => expect(saved).toEqual(["chats-ann.json"]))
    expect(calls.find((c) => c.url.includes("/export"))!.url).toBe(
      "/api/v1/admin/chat/export?email=ann%40example.com"
    )

    await user.click(
      within(dialog).getByRole("button", { name: "Erase chats" })
    )
    const confirm = await screen.findByRole("alertdialog", {
      name: "Erase every chat for ann@example.com? This can't be undone.",
    })
    expect(posted("/erase")).toBe(false)
    await user.click(
      within(confirm).getByRole("button", { name: "Erase chats" })
    )
    await waitFor(() => expect(posted("/erase")).toBe(true))
    expect(
      JSON.parse(calls.find((c) => c.url.endsWith("/erase"))!.body!)
    ).toEqual({ email: "ann@example.com" })
    expect(await screen.findByText("2 chats erased")).toBeInTheDocument()
  })
})

describe("Live chat sidebar badge", () => {
  it("polls the unread count over the layout's first count", async () => {
    state.unread = 5
    render(<Shell roles={["intake"]} />)
    const nav = screen.getByRole("navigation", { name: "Admin" })
    expect(
      within(nav).getByRole("link", { name: "Live chat" })
    ).toHaveAttribute("href", "/admin/chat")
    expect(
      await within(nav).findByRole("img", { name: "5 unread chats" })
    ).toHaveTextContent("5")
  })

  it("starts from the layout's count", () => {
    render(<Shell roles={["owner"]} badges={{ "chat-unread": 3 }} />)
    expect(
      screen.getByRole("img", { name: "3 unread chats" })
    ).toBeInTheDocument()
    expect(calls.some((c) => c.url.endsWith("/chat/unread"))).toBe(false)
  })

  it("is absent, and never polled, for roles without chat:read", async () => {
    render(<Shell roles={["editor"]} />)
    await screen.findByRole("navigation", { name: "Admin" })
    expect(screen.queryByRole("link", { name: "Live chat" })).toBeNull()
    expect(calls.some((c) => c.url.includes("/chat/"))).toBe(false)
  })
})

describe("formatMessageTime", () => {
  const now = new Date("2026-11-15T15:00:00Z")
  it("shows the time today and the day before that, in Irish time", () => {
    expect(formatMessageTime("2026-11-15T09:05:00Z", now)).toBe("09:05")
    expect(formatMessageTime("2026-11-03T21:40:00Z", now)).toBe("3 Nov, 21:40")
  })
})
