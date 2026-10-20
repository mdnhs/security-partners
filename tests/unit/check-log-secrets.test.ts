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

  it("flags URL-encoded tokens (a ?next= or logged redirect)", () => {
    expect(
      findSecrets(
        "redirect /admin/sign-in?next=%2Fadmin%2Fset-password%3Ftoken%3DAbCdEfGhIjKlMnOpQrStUv12",
        []
      )
    ).toEqual(["a ?token= value"])
  })

  it("flags session cookies, JSON tokens and Bearer credentials", () => {
    expect(
      findSecrets(
        "cookie: __Secure-sp.session_token=AbCdEfGhIjKlMnOpQrStUv12.sig",
        []
      )
    ).toEqual(["a session cookie"])
    expect(
      findSecrets(
        'body {"token":"AbCdEfGhIjKlMnOpQrStUv12","redirect":false}',
        []
      )
    ).toEqual(["a JSON token"])
    expect(
      findSecrets("authorization: Bearer sk-ant-AbCdEfGhIjKlMnOpQr", [])
    ).toEqual(["a Bearer token"])
  })

  it("ignores short or empty token-like values", () => {
    expect(
      findSecrets('{"token":null} ?token= session_token=; Bearer x', [])
    ).toEqual([])
  })

  it("passes clean output", () => {
    expect(findSecrets("[api] 0190… HTTP 502", ["secret-value-1"])).toEqual([])
  })
})
