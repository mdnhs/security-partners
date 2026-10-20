import { afterEach, describe, expect, it, vi } from "vitest"

import { isUuid, randomId } from "@/lib/ids"

describe("isUuid (ids that may go into an API path)", () => {
  it.each([
    "0190a6e0-0000-7000-8000-0000000000ff",
    "00000000-0000-7000-8000-000000000001",
    "6F9619FF-8B86-4D11-B42D-00C04FC964FF",
  ])("accepts %s", (value) => expect(isUuid(value)).toBe(true))

  it.each([
    null,
    undefined,
    1,
    "",
    "../../admin/users",
    "..%2F..%2Fusers%2Fx",
    "x?role=admin",
    "0190a6e0-0000-7000-8000-0000000000ff/../users",
    " 0190a6e0-0000-7000-8000-0000000000ff",
    "0190a6e0-0000-7000-8000-0000000000ff\n",
    "0190a6e0000070008000000000000ff",
    "0190a6e0-0000-0000-8000-0000000000ff",
  ])("rejects %j", (value) => expect(isUuid(value)).toBe(false))
})

describe("randomId (client ids, secure context or not)", () => {
  afterEach(() => vi.unstubAllGlobals())

  const V4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

  it("is a v4 uuid from crypto.randomUUID", () => {
    const a = randomId()
    expect(a).toMatch(V4)
    expect(isUuid(a)).toBe(true)
    expect(randomId()).not.toBe(a)
  })

  it("falls back to getRandomValues without crypto.randomUUID (plain http)", () => {
    const real = globalThis.crypto
    vi.stubGlobal("crypto", {
      getRandomValues: real.getRandomValues.bind(real),
    })
    const a = randomId()
    expect(a).toMatch(V4)
    expect(randomId()).not.toBe(a)
  })
})
