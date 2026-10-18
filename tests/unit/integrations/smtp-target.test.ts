import { describe, expect, it, vi } from "vitest"

import {
  isBlockedSmtpAddress,
  isLoopbackHost,
  resolveSmtpTarget,
  SMTP_LOOKUP_TIMEOUT_MS,
} from "@/server/lib/smtp-target"

describe("isBlockedSmtpAddress", () => {
  it.each([
    "127.0.0.1",
    "127.8.9.10",
    "0.0.0.0",
    "169.254.169.254",
    "169.254.1.1",
    "100.100.100.200",
    "::1",
    "fe80::1",
    "febf::1",
    "fd00:ec2::254",
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
  ])("blocks %s", (address) => {
    expect(isBlockedSmtpAddress(address)).toBe(true)
  })

  it.each([
    "10.0.0.25",
    "172.16.4.4",
    "192.168.1.10",
    "203.0.113.7",
    "2001:db8::25",
    "fec0::1",
    "::ffff:10.0.0.1",
  ])("allows %s (public or RFC 1918)", (address) => {
    expect(isBlockedSmtpAddress(address)).toBe(false)
  })
})

describe("isLoopbackHost", () => {
  it("recognises literal loopback names and addresses only", () => {
    for (const host of [
      "localhost",
      "mail.localhost",
      "127.0.0.1",
      "127.1.2.3",
      "::1",
    ])
      expect(isLoopbackHost(host)).toBe(true)
    for (const host of ["smtp.example.ie", "10.0.0.1", "169.254.169.254"])
      expect(isLoopbackHost(host)).toBe(false)
  })
})

describe("resolveSmtpTarget", () => {
  it("outside production uses the host as is (dev Mailpit on loopback)", async () => {
    const lookup = vi.fn()
    expect(
      await resolveSmtpTarget("127.0.0.1", { production: false, lookup })
    ).toEqual({ kind: "ok", address: "127.0.0.1" })
    expect(lookup).not.toHaveBeenCalled()
  })

  it("production: blocks loopback, link-local and metadata targets", async () => {
    const lookup = vi.fn()
    for (const host of ["127.0.0.1", "169.254.169.254", "localhost"])
      expect(
        (await resolveSmtpTarget(host, { production: true, lookup })).kind
      ).toBe("blocked")
    expect(lookup).not.toHaveBeenCalled()
  })

  it("production: a name is blocked when any of its addresses is", async () => {
    const lookup = vi.fn(async () => [
      { address: "203.0.113.7" },
      { address: "169.254.169.254" },
    ])
    expect(
      await resolveSmtpTarget("rebind.example", { production: true, lookup })
    ).toEqual({ kind: "blocked" })
  })

  it("production: an allowed name connects to its first resolved address", async () => {
    const lookup = vi.fn(async () => [
      { address: "10.0.0.25" },
      { address: "10.0.0.26" },
    ])
    expect(
      await resolveSmtpTarget("relay.corp.example", {
        production: true,
        lookup,
      })
    ).toEqual({ kind: "ok", address: "10.0.0.25" })
  })

  it("production: a name that does not resolve is unresolved", async () => {
    const lookup = vi.fn(async () => {
      throw Object.assign(new Error("getaddrinfo ENOTFOUND"), {
        code: "ENOTFOUND",
      })
    })
    expect(
      await resolveSmtpTarget("nope.example", { production: true, lookup })
    ).toEqual({ kind: "unresolved" })
  })

  it("production: a hanging DNS lookup is unresolved after the timeout (lead emails send inline)", async () => {
    const lookup = vi.fn(() => new Promise<never>(() => undefined))
    const started = Date.now()
    expect(
      await resolveSmtpTarget("slow.example", {
        production: true,
        lookup,
        timeoutMs: 30,
      })
    ).toEqual({ kind: "unresolved" })
    expect(Date.now() - started).toBeLessThan(1_000)
    expect(SMTP_LOOKUP_TIMEOUT_MS).toBeGreaterThan(0)
    expect(SMTP_LOOKUP_TIMEOUT_MS).toBeLessThanOrEqual(3_000)
  })

  it("defaults to NODE_ENV", async () => {
    vi.stubEnv("NODE_ENV", "production")
    try {
      expect((await resolveSmtpTarget("127.0.0.1")).kind).toBe("blocked")
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
