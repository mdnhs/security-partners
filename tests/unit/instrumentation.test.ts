import { afterEach, describe, expect, it, vi } from "vitest"

const { startScheduler } = vi.hoisted(() => ({
  startScheduler: vi.fn(() => true),
}))
vi.mock("@/server/lib/scheduler", () => ({ startScheduler }))

import { register } from "@/instrumentation"

afterEach(() => {
  vi.unstubAllEnvs()
  startScheduler.mockClear()
})

describe("instrumentation register()", () => {
  it("starts the scheduler on the Node.js runtime only", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge")
    await register()
    expect(startScheduler).not.toHaveBeenCalled()
    vi.stubEnv("NEXT_RUNTIME", "nodejs")
    await register()
    expect(startScheduler).toHaveBeenCalledTimes(1)
  })
})
