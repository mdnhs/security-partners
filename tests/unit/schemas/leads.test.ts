import { describe, expect, it } from "vitest"

import { LEAD_STATUSES, leadSubmission } from "@/lib/schemas/api/leads"
import { LEAD_STATUSES as DB_LEAD_STATUSES } from "@/server/db/schema"

const valid = {
  name: "  Dinn Rí ",
  email: " dinn@example.ie ",
  message: "Line one\nLine two\ttabbed",
}

describe("leadSubmission (shared Zod schema, spec §9)", () => {
  it("trims, keeps inner text, defaults consent to false and empty optionals to null", () => {
    expect(
      leadSubmission.parse({ ...valid, phone: "  ", sourcePage: "/contact" })
    ).toEqual({
      name: "Dinn Rí",
      email: "dinn@example.ie",
      phone: null,
      company: null,
      service: null,
      message: "Line one\nLine two\ttabbed",
      consent: false,
      sourcePage: "/contact",
    })
  })

  it("rejects bad email, empty message, control characters and long text", () => {
    const issues = (input: object) =>
      leadSubmission
        .safeParse({ ...valid, ...input })
        .error?.issues.map((i) => i.path.join(".")) ?? []
    expect(issues({ email: "nope" })).toEqual(["email"])
    expect(issues({ message: "   " })).toEqual(["message"])
    expect(issues({ name: "A\nB" })).toEqual(["name"])
    expect(issues({ message: "nul\u0000byte" })).toEqual(["message"])
    expect(issues({ message: "x".repeat(5001) })).toEqual(["message"])
    expect(issues({ sourcePage: "https://evil.example" })).toEqual([
      "sourcePage",
    ])
    expect(issues({ sourcePage: "//evil.example" })).toEqual(["sourcePage"])
  })

  it("sourcePage: same-site path only — no NUL, backslash or protocol-relative form", () => {
    const issues = (sourcePage: string) =>
      leadSubmission
        .safeParse({ ...valid, sourcePage })
        .error?.issues.map((i) => i.path.join(".")) ?? []
    expect(issues("/contact\u0000x")).toEqual(["sourcePage"])
    expect(issues("/\\evil.example")).toEqual(["sourcePage"])
    expect(issues("//x")).toEqual(["sourcePage"])
    expect(issues("/a\\b")).toEqual(["sourcePage"])
    expect(issues("/services/static-guarding?ref=x#top")).toEqual([])
  })

  it("single-line fields reject line/paragraph separators and bidi controls", () => {
    const issues = (input: object) =>
      leadSubmission
        .safeParse({ ...valid, ...input })
        .error?.issues.map((i) => i.path.join(".")) ?? []
    for (const ch of [
      "\u2028",
      "\u2029",
      "\u202A",
      "\u202B",
      "\u202C",
      "\u202D",
      "\u202E",
      "\u2066",
      "\u2067",
      "\u2068",
      "\u2069",
    ]) {
      expect(issues({ name: `Dinn${ch}Rí` })).toEqual(["name"])
      expect(issues({ company: `Acme${ch}Ltd` })).toEqual(["company"])
      expect(issues({ phone: `085${ch}000` })).toEqual(["phone"])
      expect(issues({ service: `x${ch}y` })).toEqual(["service"])
      expect(new Set(issues({ sourcePage: `/a${ch}b` }))).toEqual(
        new Set(["sourcePage"])
      )
    }
  })

  it("accepts the honeypot (any type) and Turnstile token fields", () => {
    expect(
      leadSubmission.parse({ ...valid, website: "x", turnstileToken: "t" })
    ).toMatchObject({ website: "x", turnstileToken: "t" })
    for (const website of [1, true, ["x"], { a: 1 }, null])
      expect(leadSubmission.safeParse({ ...valid, website }).success).toBe(true)
  })

  it("lists the same statuses as the database enum", () => {
    expect([...LEAD_STATUSES]).toEqual([...DB_LEAD_STATUSES])
  })
})
