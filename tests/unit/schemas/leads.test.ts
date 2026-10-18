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

  it("accepts the honeypot and Turnstile token fields", () => {
    expect(
      leadSubmission.parse({ ...valid, website: "x", turnstileToken: "t" })
    ).toMatchObject({ website: "x", turnstileToken: "t" })
  })

  it("lists the same statuses as the database enum", () => {
    expect([...LEAD_STATUSES]).toEqual([...DB_LEAD_STATUSES])
  })
})
