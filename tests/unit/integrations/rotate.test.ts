import { describe, expect, it } from "vitest"

import { decryptSecret, encryptSecret } from "@/server/lib/crypto"
import { reencryptDraft } from "@/server/modules/integrations/rotate"

const OLD = "old-secret-0123456789abcdef0123456789abcdef"
const NEW = "new-secret-0123456789abcdef0123456789abcdef"
const SMTP_AAD = "integrations.smtp.password"
const smtp = {
  host: "smtp.example.test",
  port: 587,
  secure: false,
  user: "mailer",
  fromName: "Security Partners",
  fromAddress: "no-reply@example.test",
}

describe("reencryptDraft (spec §4 rotation)", () => {
  it("re-encrypts each secret field with the new key and keeps other fields", () => {
    const draft = {
      ...smtp,
      password: encryptSecret("p@ss-word-1", SMTP_AAD, OLD),
    }
    const result = reencryptDraft("integrations.smtp", draft, OLD, NEW)
    expect(result.fields).toEqual(["integrations.smtp.password"])
    expect(result.alreadyCurrent).toEqual([])
    expect(decryptSecret(String(result.draft.password), SMTP_AAD, NEW)).toBe(
      "p@ss-word-1"
    )
    expect(() =>
      decryptSecret(String(result.draft.password), SMTP_AAD, OLD)
    ).toThrow()
    expect(result.draft).toMatchObject(smtp)
  })

  it("covers every secret of a multi-secret integration (R2)", () => {
    const draft = {
      accountId: "acc",
      jurisdiction: "eu",
      bucket: "sp-media",
      accessKeyId: encryptSecret("AKIA-1", "integrations.r2.accessKeyId", OLD),
      secretAccessKey: encryptSecret(
        "s3cr3t",
        "integrations.r2.secretAccessKey",
        OLD
      ),
    }
    const result = reencryptDraft("integrations.r2", draft, OLD, NEW)
    expect(result.fields.sort()).toEqual([
      "integrations.r2.accessKeyId",
      "integrations.r2.secretAccessKey",
    ])
    expect(
      decryptSecret(
        String(result.draft.secretAccessKey),
        "integrations.r2.secretAccessKey",
        NEW
      )
    ).toBe("s3cr3t")
  })

  it("skips empty secrets and reports secrets already under the new key", () => {
    const draft = {
      ...smtp,
      password: encryptSecret("x".repeat(16), SMTP_AAD, NEW),
    }
    expect(reencryptDraft("integrations.smtp", draft, OLD, NEW)).toEqual({
      draft,
      fields: [],
      alreadyCurrent: ["integrations.smtp.password"],
    })
    const empty = { ...smtp, password: "" }
    expect(reencryptDraft("integrations.smtp", empty, OLD, NEW).fields).toEqual(
      []
    )
  })

  it("refuses a secret neither key can read (never writes garbage)", () => {
    const other = "third-secret-0123456789abcdef0123456789abcd"
    const draft = { ...smtp, password: encryptSecret("p", SMTP_AAD, other) }
    expect(() => reencryptDraft("integrations.smtp", draft, OLD, NEW)).toThrow(
      "integrations.smtp.password cannot be decrypted with the old or the new secret"
    )
  })
})
