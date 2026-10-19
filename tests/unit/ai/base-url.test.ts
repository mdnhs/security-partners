import { describe, expect, it } from "vitest"

import { baseUrlProblem, normaliseBaseUrl } from "@/lib/ai/base-url"

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

  it("rejects very long input", () => {
    expect(
      baseUrlProblem(`https://a.com/${"x".repeat(600)}`, strict)
    ).not.toBeNull()
  })
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
