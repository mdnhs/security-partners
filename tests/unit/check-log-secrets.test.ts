import { describe, expect, it } from "vitest"

import { findSecrets } from "../../scripts/check-log-secrets"

describe("check-log-secrets", () => {
  it("names each known secret found, without echoing it", () => {
    const found = findSecrets("login with hunter2-hunter2 ok", [
      "hunter2-hunter2",
      "never-there-123",
    ])
    expect(found).toEqual(["known secret #1"])
    expect(found.join()).not.toContain("hunter2")
  })

  it("flags single-use tokens in logged URLs", () => {
    expect(
      findSecrets(
        "GET /admin/set-password?token=AbCdEfGhIjKlMnOpQrStUv12 200",
        []
      )
    ).toEqual(["a ?token= value"])
  })

  it("passes clean output", () => {
    expect(findSecrets("[api] 0190… HTTP 502", ["secret-value-1"])).toEqual([])
  })
})
