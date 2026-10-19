import { describe, expect, it } from "vitest"

import { isUuid } from "@/lib/ids"

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
