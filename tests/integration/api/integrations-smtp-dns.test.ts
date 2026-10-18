import { beforeEach, describe, expect, it, vi } from "vitest"

// Count DNS checks: the SMTP host is resolved once, before the save
// transaction, and only after it passes the schema's own host checks.
vi.mock("@/server/lib/smtp-target", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/lib/smtp-target")>()
  return { ...actual, resolveSmtpTarget: vi.fn(actual.resolveSmtpTarget) }
})

import { resolveSmtpTarget } from "@/server/lib/smtp-target"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

const values = (host: string) => ({
  host,
  port: 1025,
  secure: false,
  user: "",
  password: "",
  fromName: "Security Partners",
  fromAddress: "no-reply@example.test",
})

let owner: string
beforeEach(async () => {
  await resetDb()
  owner = (await signedInUser(["owner"])).cookie
  vi.mocked(resolveSmtpTarget).mockClear()
})

describe("SMTP host DNS check on save", () => {
  it("never looks up a host the schema refuses", async () => {
    const res = await adminRequest("/integrations/integrations.smtp", {
      cookie: owner,
      method: "PUT",
      json: { version: 0, values: values("bad host/with spaces") },
    })
    expect(res.status).toBe(422)
    expect(resolveSmtpTarget).not.toHaveBeenCalled()
  })

  it("looks up a padded, mixed-case host once (trimmed), reused in the transaction", async () => {
    const res = await adminRequest("/integrations/integrations.smtp", {
      cookie: owner,
      method: "PUT",
      json: { version: 0, values: values("  Mail.Example.TEST  ") },
    })
    expect(res.status).toBe(200)
    expect(resolveSmtpTarget).toHaveBeenCalledTimes(1)
    expect(resolveSmtpTarget).toHaveBeenCalledWith("Mail.Example.TEST")
  })
})
