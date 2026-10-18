import { describe, expect, it } from "vitest"

import { assertE2eDatabase, E2E_ENV, PORT, SERVER_ENV } from "../e2e/env"

describe("E2E database guard (ledger P03-9: one guard for visual and E2E seeds)", () => {
  it("accepts the local E2E database", () => {
    expect(() => assertE2eDatabase(E2E_ENV.DATABASE_URL)).not.toThrow()
    expect(() =>
      assertE2eDatabase("postgres://sp:sp@localhost:5432/ci_e2e")
    ).not.toThrow()
  })

  it.each([
    "postgres://sp:sp@127.0.0.1:5432/sp_dev",
    "postgres://sp:sp@db.example.ie:5432/sp_e2e",
    "postgres://sp:sp@127.0.0.1:5432/sp_e2e_backup",
    "not a url",
  ])("refuses %s", (url) => {
    expect(() => assertE2eDatabase(url)).toThrow("Refusing to reset")
  })

  it("serves the standalone server on loopback at the E2E port", () => {
    expect(SERVER_ENV).toEqual({
      ...E2E_ENV,
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
    })
  })
})
