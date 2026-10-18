import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { MigrateMediaPanel } from "@/components/admin/integrations/migrate-media-panel"
import { makeQueryClient } from "@/components/admin/providers"
import {
  type AdminSession,
  AdminSessionProvider,
} from "@/components/admin/session-provider"
import type { MediaMigrationStatus } from "@/lib/schemas/api/media"

let current: MediaMigrationStatus
const methods: string[] = []

beforeEach(() => {
  methods.length = 0
  current = {
    r2Configured: true,
    r2Error: null,
    failed: [],
    onDisk: 4,
    inR2: 1,
    state: "idle",
    lastRunAt: null,
    lastError: null,
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      methods.push(init?.method ?? "GET")
      if (init?.method === "POST")
        current = { ...current, state: "queued", failed: [], lastError: null }
      return new Response(JSON.stringify(current), {
        status: init?.method === "POST" ? 202 : 200,
        headers: { "content-type": "application/json" },
      })
    })
  )
})

const session: AdminSession = {
  user: {
    id: "u1",
    name: "O",
    email: "o@example.test",
    title: null,
    twoFactorEnabled: true,
  },
  roles: ["owner"],
  impersonatedBy: null,
}

describe("MigrateMediaPanel", () => {
  it("shows counts and queues the move", async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <AdminSessionProvider value={session}>
          <MigrateMediaPanel />
        </AdminSessionProvider>
      </QueryClientProvider>
    )
    expect(
      await screen.findByText("4 files on the server disk · 1 in R2")
    ).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Move uploads to R2" }))
    await waitFor(() => expect(methods).toContain("POST"))
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Queued")
    )
    expect(
      screen.getByRole("button", { name: "Move uploads to R2" })
    ).toBeDisabled()
  })

  it("explains when R2 is not saved yet", async () => {
    current = { ...current, r2Configured: false }
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <AdminSessionProvider value={session}>
          <MigrateMediaPanel />
        </AdminSessionProvider>
      </QueryClientProvider>
    )
    expect(
      await screen.findByText("Save the R2 settings above first.")
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Move uploads to R2" })
    ).toBeDisabled()
  })

  it("shows a running move, its last problem and last run", async () => {
    current = {
      ...current,
      state: "running",
      lastRunAt: "2026-10-16T09:00:00.000Z",
      lastError: "Not moved: 2026/10/a.png: R2 answered with HTTP 403.",
    }
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <AdminSessionProvider value={session}>
          <MigrateMediaPanel />
        </AdminSessionProvider>
      </QueryClientProvider>
    )
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Moving files…")
    )
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Not moved: 2026/10/a.png: R2 answered with HTTP 403."
    )
    expect(screen.getByText(/^Last run /)).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Move uploads to R2" })
    ).toBeDisabled()
  })

  const renderPanel = () =>
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <AdminSessionProvider value={session}>
          <MigrateMediaPanel />
        </AdminSessionProvider>
      </QueryClientProvider>
    )

  it("keeps one status live region from the first render", () => {
    renderPanel()
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
  })

  it("lists the files of a stopped move and lets it start again", async () => {
    const user = userEvent.setup()
    current = {
      ...current,
      state: "stopped",
      failed: [
        "2026/10/a.png: file missing on the server disk",
        "2026/10/b.png: R2 answered with HTTP 403.",
      ],
      lastError: "Not moved: …",
    }
    renderPanel()
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Stopped: the last run could not move any file."
      )
    )
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent(
      "2026/10/a.png: file missing on the server disk"
    )
    expect(alert).toHaveTextContent("2026/10/b.png: R2 answered with HTTP 403.")
    const button = screen.getByRole("button", { name: "Move uploads to R2" })
    expect(button).toBeEnabled()
    await user.click(button)
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Queued")
    )
    expect(methods).toContain("POST")
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("says when the saved R2 settings cannot be read", async () => {
    current = {
      ...current,
      r2Configured: false,
      r2Error: "The saved R2 settings can't be read. Save them again.",
    }
    renderPanel()
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The saved R2 settings can't be read. Save them again."
    )
    expect(
      screen.getByRole("button", { name: "Move uploads to R2" })
    ).toBeDisabled()
  })
})
