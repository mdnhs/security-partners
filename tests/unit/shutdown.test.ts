import { EventEmitter } from "node:events"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { installShutdownHandlers } from "@/server/lib/shutdown"

/** A stand-in for `process`: signals are plain events, exit is a spy. */
function fakeProcess() {
  const proc = Object.assign(new EventEmitter(), {
    exit: vi.fn(),
  })
  return proc
}

const flush = () => new Promise((resolve) => setImmediate(resolve))

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("installShutdownHandlers (SIGTERM/SIGINT → stopScheduler)", () => {
  it("installs once per process, even when register() runs again (dev HMR)", () => {
    const proc = fakeProcess()
    const stop = vi.fn(async () => {})
    expect(installShutdownHandlers({ proc, stop })).toBe(true)
    expect(installShutdownHandlers({ proc, stop })).toBe(false)
    expect(proc.listenerCount("SIGTERM")).toBe(1)
    expect(proc.listenerCount("SIGINT")).toBe(1)
  })

  it("with Next's own handler present at install: stops the scheduler and leaves the exit to Next", async () => {
    vi.useFakeTimers()
    const proc = fakeProcess()
    const next = vi.fn()
    proc.on("SIGTERM", next)
    proc.on("SIGINT", next)
    const stop = vi.fn(async () => {})
    installShutdownHandlers({ proc, stop })
    proc.emit("SIGTERM", "SIGTERM")
    proc.emit("SIGINT", "SIGINT") // a second signal: still only one stop
    await vi.advanceTimersByTimeAsync(29_999)
    expect(stop).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledTimes(2)
    expect(proc.exit).not.toHaveBeenCalled() // Next's drain window
    // Our handlers are gone: nothing of ours keeps catching signals.
    expect(proc.listenerCount("SIGTERM")).toBe(1)
    expect(proc.listenerCount("SIGINT")).toBe(1)
  })

  it("a handler present at install that never exits cannot hang the process (backstop exit)", async () => {
    vi.useFakeTimers()
    const proc = fakeProcess()
    proc.on("SIGTERM", () => {}) // third-party listener, never exits
    installShutdownHandlers({ proc, stop: async () => {} })
    proc.emit("SIGTERM", "SIGTERM")
    await vi.advanceTimersByTimeAsync(30_000)
    expect(proc.exit).toHaveBeenCalledExactlyOnceWith(143)
  })

  it("a listener added after install does not stop us from exiting", async () => {
    const proc = fakeProcess()
    installShutdownHandlers({ proc, stop: async () => {} })
    proc.on("SIGTERM", () => {}) // third-party, registered later
    proc.emit("SIGTERM", "SIGTERM")
    await flush()
    expect(proc.exit).toHaveBeenCalledExactlyOnceWith(143)
  })

  it("without another handler (NEXT_MANUAL_SIG_HANDLE): drains the running tick, then exits with the signal's code", async () => {
    const proc = fakeProcess()
    let finish!: () => void
    const stop = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)))
    installShutdownHandlers({ proc, stop })
    proc.emit("SIGINT", "SIGINT")
    await flush()
    expect(stop).toHaveBeenCalledTimes(1)
    expect(proc.exit).not.toHaveBeenCalled() // the in-flight job still runs
    finish()
    await flush()
    expect(proc.exit).toHaveBeenCalledExactlyOnceWith(130)
  })

  it("never waits longer than the drain limit, with an unref'd timer", async () => {
    vi.useFakeTimers()
    const proc = fakeProcess()
    const unref = vi.fn()
    const realSetTimeout = globalThis.setTimeout
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((
      ...args: Parameters<typeof setTimeout>
    ) => {
      const timer = realSetTimeout(...args)
      return Object.assign(timer, { unref })
    }) as unknown as typeof setTimeout)
    installShutdownHandlers({
      proc,
      stop: () => new Promise<void>(() => {}), // a job that never ends
      drainMs: 5_000,
    })
    proc.emit("SIGTERM", "SIGTERM")
    await vi.advanceTimersByTimeAsync(4_999)
    expect(proc.exit).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(proc.exit).toHaveBeenCalledExactlyOnceWith(143)
    expect(unref).toHaveBeenCalled()
  })

  it("a failing stop still lets the process exit", async () => {
    const proc = fakeProcess()
    vi.spyOn(console, "error").mockImplementation(() => {})
    installShutdownHandlers({
      proc,
      stop: async () => {
        throw new Error("db down")
      },
    })
    proc.emit("SIGTERM", "SIGTERM")
    await flush()
    expect(proc.exit).toHaveBeenCalledExactlyOnceWith(143)
  })
})
