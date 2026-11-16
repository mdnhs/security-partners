import { afterEach, describe, expect, it, vi } from "vitest"

const deferred = vi.hoisted(() => ({ tasks: [] as Promise<unknown>[] }))
vi.mock("next/server", () => ({
  after: (task: () => unknown) => {
    deferred.tasks.push(Promise.resolve().then(task))
  },
}))

import { defer } from "@/server/lib/defer"

afterEach(() => {
  deferred.tasks = []
  vi.restoreAllMocks()
})

describe("defer", () => {
  it("logs the error's name only, never its message (it can carry chat text)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    class DrizzleQueryError extends Error {
      override name = "DrizzleQueryError"
    }
    defer(async () => {
      throw new DrizzleQueryError("insert ... params: secret reply body")
    }, "chat-bot")
    await Promise.all(deferred.tasks)
    expect(error).toHaveBeenCalledTimes(1)
    const logged = error.mock.calls[0]!.map(String).join(" ")
    expect(logged).toContain("[defer] chat-bot failed")
    expect(logged).toContain("DrizzleQueryError")
    expect(logged).not.toContain("secret reply body")
  })

  it("logs the type of a non-Error rejection", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    defer(() => Promise.reject("visitor said hello"), "x")
    await Promise.all(deferred.tasks)
    const logged = error.mock.calls[0]!.map(String).join(" ")
    expect(logged).toContain("string")
    expect(logged).not.toContain("visitor said hello")
  })
})
