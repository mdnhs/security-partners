import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  FIRST_TICK_DELAY_MS,
  startScheduler,
  stopScheduler,
  TICK_INTERVAL_MS,
} from "@/server/lib/scheduler"

const ENV = {
  DATABASE_URL: "postgres://sp:sp@127.0.0.1:5432/sp_test",
  BETTER_AUTH_SECRET: "s".repeat(40),
  BETTER_AUTH_URL: "http://localhost:3000",
}
const stubEnv = () => {
  for (const [key, value] of Object.entries(ENV)) vi.stubEnv(key, value)
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  stopScheduler()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("startScheduler (master 5.4)", () => {
  it("does not start during next build", () => {
    stubEnv()
    vi.stubEnv("NEXT_PHASE", "phase-production-build")
    expect(startScheduler()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("does not start without the app env (logged, not thrown)", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(startScheduler()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    expect(error).toHaveBeenCalled()
  })

  it("starts once per process: a first tick and a 60 s interval", () => {
    stubEnv()
    expect(startScheduler()).toBe(true)
    expect(vi.getTimerCount()).toBe(2)
    expect(startScheduler()).toBe(false)
    expect(vi.getTimerCount()).toBe(2)
    expect(TICK_INTERVAL_MS).toBe(60_000)
    expect(FIRST_TICK_DELAY_MS).toBeLessThan(TICK_INTERVAL_MS)
    stopScheduler()
    expect(vi.getTimerCount()).toBe(0)
  })
})
