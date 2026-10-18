import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const repo = vi.hoisted(() => ({
  upsertRecurringJob: vi.fn(async () => {}),
  claimDueJobs: vi.fn(),
  finishJob: vi.fn(async () => {}),
  deleteClaimedJob: vi.fn(async () => {}),
  releaseClaimedJob: vi.fn(async () => {}),
}))
vi.mock("@/server/modules/jobs/repo", () => repo)
vi.mock("@/server/db/client", () => ({ getDb: () => ({}) }))

import {
  FIRST_TICK_DELAY_MS,
  startScheduler,
  stopScheduler,
} from "@/server/lib/scheduler"

const ENV = {
  DATABASE_URL: "postgres://sp:sp@127.0.0.1:5432/sp_test",
  BETTER_AUTH_SECRET: "s".repeat(40),
  BETTER_AUTH_URL: "http://localhost:3000",
}

beforeEach(() => {
  vi.useFakeTimers()
  for (const [key, value] of Object.entries(ENV)) vi.stubEnv(key, value)
})
afterEach(async () => {
  await stopScheduler()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe("stopScheduler (graceful shutdown)", () => {
  it("resolves only once the running tick has released its claims", async () => {
    let claim!: (rows: unknown[]) => void
    repo.claimDueJobs.mockReturnValue(
      new Promise((resolve) => (claim = resolve))
    )
    expect(startScheduler()).toBe(true)
    await vi.advanceTimersByTimeAsync(FIRST_TICK_DELAY_MS)
    expect(repo.claimDueJobs).toHaveBeenCalledTimes(1)

    let stopped = false
    const stopping = stopScheduler().then(() => (stopped = true))
    expect(vi.getTimerCount()).toBe(0) // no further ticks
    await vi.advanceTimersByTimeAsync(0)
    expect(stopped).toBe(false)

    claim([
      { id: "j1", name: "publish-scheduled", key: "a", payload: null },
      { id: "j2", name: "prune-revisions", key: "b", payload: null },
    ])
    await stopping
    expect(stopped).toBe(true)
    // Stopped before the first job started: both claims are handed back.
    expect(repo.releaseClaimedJob).toHaveBeenCalledTimes(2)
    expect(repo.finishJob).not.toHaveBeenCalled()
  })
})
