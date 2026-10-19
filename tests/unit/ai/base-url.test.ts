import { describe, expect, it } from "vitest"

import {
  baseUrlProblem,
  isBlockedIpAddress,
  normaliseBaseUrl,
} from "@/lib/ai/base-url"

const strict = { allowLocalHttp: false }
const dev = { allowLocalHttp: true }

describe("baseUrlProblem (SSRF guard for the OpenAI-compatible base URL)", () => {
  it.each([
    "http://api.x.com",
    "https://10.0.0.1",
    "https://192.168.1.2/v1",
    "https://[::1]",
    "https://169.254.169.254",
    "https://localhost",
    "https://a.internal",
  ])("rejects %s", (u) => expect(baseUrlProblem(u, strict)).not.toBeNull())

  it("accepts https public hosts and dev localhost", () => {
    expect(baseUrlProblem("https://api.groq.com/openai/v1", strict)).toBeNull()
    expect(baseUrlProblem("http://localhost:11434/v1", dev)).toBeNull()
  })

  it.each([
    "",
    "not a url",
    "ftp://api.x.com",
    "javascript:alert(1)",
    "https://172.16.0.1",
    "https://172.31.255.255",
    "https://127.0.0.1",
    "https://127.1",
    "https://2130706433", // 127.0.0.1 as one decimal number
    "https://0x7f000001",
    "https://0.0.0.0",
    "https://100.100.100.200", // cloud metadata (CGNAT range)
    "https://[fe80::1]",
    "https://[fc00::1]",
    "https://[fd12:3456::1]",
    "https://[::]",
    "https://[::ffff:127.0.0.1]",
    "https://[::ffff:a9fe:a9fe]", // 169.254.169.254 mapped
    "https://printer.local",
    "https://metadata.google.internal",
    "https://app.localhost",
    "https://metadata", // single-label name
    "https://user:pass@api.x.com/v1",
    "https://api.x.com/v1?x=1",
    "https://api.x.com/v1#frag",
  ])("rejects %s", (u) => expect(baseUrlProblem(u, strict)).not.toBeNull())

  it("allows plain http only to localhost, and only when local http is allowed", () => {
    expect(baseUrlProblem("http://localhost:11434/v1", strict)).not.toBeNull()
    expect(baseUrlProblem("http://127.0.0.1:1234/v1", dev)).toBeNull()
    expect(baseUrlProblem("http://api.x.com/v1", dev)).not.toBeNull()
    expect(baseUrlProblem("http://10.0.0.5/v1", dev)).not.toBeNull()
  })

  it("accepts public IP literals and ports over https", () => {
    expect(baseUrlProblem("https://8.8.8.8/v1", strict)).toBeNull()
    expect(baseUrlProblem("https://172.32.0.1", strict)).toBeNull()
    expect(baseUrlProblem("https://[2606:4700::1111]/v1", strict)).toBeNull()
    expect(baseUrlProblem("https://api.x.com:8443/v1/", strict)).toBeNull()
    expect(baseUrlProblem("  https://api.x.com/v1  ", strict)).toBeNull()
  })

  it.each([
    "https://198.18.0.1", // benchmarking 198.18/15
    "https://198.19.255.255",
    "https://192.0.0.170", // IETF protocol assignments (NAT64 discovery)
    "https://224.0.0.1", // multicast
    "https://240.0.0.1", // reserved
    "https://255.255.255.255",
    "https://[64:ff9b::a9fe:a9fe]", // NAT64 of 169.254.169.254
    "https://[64:ff9b::808:808]", // NAT64 of a public address: still refused
    "https://[64:ff9b:1::1]", // local-use NAT64
    "https://[2002:a9fe:a9fe::1]", // 6to4 of 169.254.169.254
    "https://[::a9fe:a9fe]", // IPv4-compatible ::169.254.169.254
    "https://[::808:808]", // IPv4-compatible, deprecated: refused
    "https://[::ffff:0:a00:1]", // IPv4-translated 10.0.0.1
    "https://[2001::1]", // Teredo
    "https://[ff02::1]", // multicast
    "https://[fec0::1]", // site-local
    "https://[fd00:ec2::254]", // AWS IMDS over IPv6
  ])("rejects special-purpose literal %s", (u) =>
    expect(baseUrlProblem(u, strict)).not.toBeNull()
  )

  it("rejects very long input", () => {
    expect(
      baseUrlProblem(`https://a.com/${"x".repeat(600)}`, strict)
    ).not.toBeNull()
  })
})

describe("isBlockedIpAddress (resolved addresses, server guard)", () => {
  it.each([
    "10.1.2.3",
    "127.0.0.1",
    "169.254.169.254",
    "100.100.100.200",
    "0.0.0.0",
    "198.18.0.1",
    "224.0.0.251",
    "::1",
    "::",
    "fe80::1",
    "fc00::1",
    "fd00:ec2::254",
    "::ffff:10.0.0.1",
    "::ffff:a9fe:a9fe",
    "[::ffff:127.0.0.1]",
    "64:ff9b::808:808",
    "2002:808:808::1",
    "::808:808",
    "ff02::1",
    "not an address",
    "",
  ])("blocks %s", (a) => expect(isBlockedIpAddress(a)).toBe(true))

  it.each(["8.8.8.8", "172.32.0.1", "2606:4700::1111", "::ffff:8.8.8.8"])(
    "allows %s",
    (a) => expect(isBlockedIpAddress(a)).toBe(false)
  )
})

describe("normaliseBaseUrl", () => {
  it("trims and drops trailing slashes", () => {
    expect(normaliseBaseUrl("  https://api.x.com/v1/  ")).toBe(
      "https://api.x.com/v1"
    )
    expect(normaliseBaseUrl("https://api.x.com//")).toBe("https://api.x.com")
    expect(normaliseBaseUrl("https://api.x.com/v1")).toBe(
      "https://api.x.com/v1"
    )
  })
})
