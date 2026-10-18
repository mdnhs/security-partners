import { beforeEach, describe, expect, it, vi } from "vitest"

const { leadBadge, getAiStatus, getShellNotifications } = vi.hoisted(() => ({
  leadBadge: vi.fn(),
  getAiStatus: vi.fn(),
  getShellNotifications: vi.fn(),
}))
vi.mock("@/server/modules/leads/service", () => ({ leadBadge }))
vi.mock("@/server/modules/ai/service", () => ({ getAiStatus }))
vi.mock("@/server/modules/dashboard/service", () => ({
  getShellNotifications,
}))

import type { Actor } from "@/server/lib/actor"
import { loadShellExtras } from "@/server/lib/admin-shell-extras"

const actor = (roles: Actor["roles"]): Actor => ({
  userId: "u1",
  roles,
  ip: null,
  userAgent: null,
  impersonatorId: null,
})

const status = { available: true } as never

beforeEach(() => {
  leadBadge.mockReset().mockResolvedValue({ newLeads: 3 })
  getAiStatus.mockReset().mockResolvedValue(status)
  getShellNotifications.mockReset().mockResolvedValue([])
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("admin frame extras (final review I7)", () => {
  it("loads the badge, AI status and bell; the bell reuses the badge count", async () => {
    const extras = await loadShellExtras(actor(["intake"]))
    expect(extras).toEqual({
      badges: { "new-leads": 3 },
      assistant: status,
      notifications: [],
    })
    expect(getShellNotifications).toHaveBeenCalledWith(expect.anything(), 3)
  })

  it("skips the badge for those who cannot read leads", async () => {
    const extras = await loadShellExtras(actor(["editor"]))
    expect(extras.badges).toEqual({})
    expect(leadBadge).not.toHaveBeenCalled()
    expect(getShellNotifications).toHaveBeenCalledWith(expect.anything(), null)
  })

  it("degrades each part on its own instead of failing the frame", async () => {
    leadBadge.mockRejectedValue(new Error("db hiccup"))
    getAiStatus.mockRejectedValue(new Error("ai settings unreadable"))
    getShellNotifications.mockRejectedValue(new Error("jobs table locked"))
    await expect(loadShellExtras(actor(["owner"]))).resolves.toEqual({
      badges: {},
      assistant: undefined,
      notifications: [],
    })
    expect(console.error).toHaveBeenCalledTimes(3)
  })
})
