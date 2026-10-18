import { afterEach, describe, expect, it, vi } from "vitest"

const { startScheduler, stopScheduler, installShutdownHandlers } = vi.hoisted(
  () => ({
    startScheduler: vi.fn(() => true),
    stopScheduler: vi.fn(async () => {}),
    installShutdownHandlers: vi.fn(() => true),
  })
)
vi.mock("@/server/lib/scheduler", () => ({ startScheduler, stopScheduler }))
vi.mock("@/server/lib/shutdown", () => ({ installShutdownHandlers }))

import { register } from "@/instrumentation"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe("instrumentation register()", () => {
  it("starts the scheduler on the Node.js runtime only", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge")
    await register()
    expect(startScheduler).not.toHaveBeenCalled()
    expect(installShutdownHandlers).not.toHaveBeenCalled()
    vi.stubEnv("NEXT_RUNTIME", "nodejs")
    await register()
    expect(startScheduler).toHaveBeenCalledTimes(1)
  })

  it("stops the scheduler on SIGTERM/SIGINT (handlers installed with stopScheduler)", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs")
    await register()
    expect(installShutdownHandlers).toHaveBeenCalledExactlyOnceWith({
      stop: stopScheduler,
    })
  })
})
