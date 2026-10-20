import { describe, expect, it } from "vitest"
import type { z } from "zod"

import {
  AI_ROLES,
  INTEGRATION_KEYS,
  INTEGRATIONS,
  integrationKeyFromSlug,
  isIntegrationKey,
  isSecretField,
} from "@/lib/schemas/integrations"

const shapeKeys = (schema: z.ZodType) =>
  Object.keys((schema as unknown as { shape: Record<string, unknown> }).shape)

describe("integration definitions (spec §5.4)", () => {
  it.each(INTEGRATION_KEYS)("%s lists exactly its schema fields", (key) => {
    const def = INTEGRATIONS[key]
    expect([...def.fields].sort()).toEqual(shapeKeys(def.schema).sort())
    for (const secret of def.secrets) expect(def.fields).toContain(secret)
    for (const field of def.fields)
      if (!isSecretField(key, field)) expect(def.defaults).toHaveProperty(field)
  })

  it("marks the bold fields of spec §5.4 as secrets", () => {
    expect(INTEGRATIONS["integrations.smtp"].secrets).toEqual(["password"])
    expect(INTEGRATIONS["integrations.r2"].secrets).toEqual([
      "accessKeyId",
      "secretAccessKey",
    ])
    expect(INTEGRATIONS["integrations.turnstile"].secrets).toEqual([
      "secretKey",
    ])
    expect(INTEGRATIONS["integrations.ai"].secrets).toEqual(["apiKey"])
  })

  it("maps admin URL slugs to keys", () => {
    expect(integrationKeyFromSlug("smtp")).toBe("integrations.smtp")
    expect(integrationKeyFromSlug("r2")).toBe("integrations.r2")
    expect(integrationKeyFromSlug("nope")).toBeNull()
    expect(isIntegrationKey("integrations.ai")).toBe(true)
    expect(isIntegrationKey("site")).toBe(false)
  })
})

describe("integration schemas", () => {
  const smtp = INTEGRATIONS["integrations.smtp"].schema
  const r2 = INTEGRATIONS["integrations.r2"].schema
  const turnstile = INTEGRATIONS["integrations.turnstile"].schema
  const ai = INTEGRATIONS["integrations.ai"].schema

  const validSmtp = {
    host: "smtp.example.ie",
    port: 587,
    secure: false,
    user: "mailer@example.ie",
    password: "pw-1234",
    fromName: "Security Partners",
    fromAddress: "no-reply@example.ie",
  }

  it("smtp: a user name needs a password; no user needs none", () => {
    expect(smtp.safeParse(validSmtp).success).toBe(true)
    const missing = smtp.safeParse({ ...validSmtp, password: "" })
    expect(missing.success).toBe(false)
    expect(missing.error!.issues[0].path).toEqual(["password"])
    expect(
      smtp.safeParse({ ...validSmtp, user: "", password: "" }).success
    ).toBe(true)
    expect(smtp.safeParse({ ...validSmtp, port: 70000 }).success).toBe(false)
    expect(smtp.safeParse({ ...validSmtp, host: "smtp example" }).success).toBe(
      false
    )
  })

  it("r2: account id, bucket name and both keys", () => {
    const valid = {
      accountId: "0123456789abcdef0123456789abcdef",
      jurisdiction: "eu",
      bucket: "sp-media",
      accessKeyId: "AKID",
      secretAccessKey: "SECRET",
    }
    expect(r2.safeParse(valid).success).toBe(true)
    expect(r2.safeParse({ ...valid, accountId: "abc" }).success).toBe(false)
    expect(r2.safeParse({ ...valid, bucket: "Bad_Bucket" }).success).toBe(false)
    expect(r2.safeParse({ ...valid, accessKeyId: "" }).success).toBe(false)
  })

  it("r2: the optional folder (keyPrefix) is lowercase segments joined by single slashes", () => {
    const valid = {
      accountId: "0123456789abcdef0123456789abcdef",
      jurisdiction: "default",
      bucket: "sp-media",
      accessKeyId: "AKID",
      secretAccessKey: "SECRET",
    }
    // Absent or empty: back-compatible, no folder.
    expect(r2.safeParse(valid).success).toBe(true)
    expect(r2.safeParse({ ...valid, keyPrefix: "" }).success).toBe(true)
    for (const ok of ["sp", "sp/media", "a-b_c/0-9", "x".repeat(64)])
      expect(r2.safeParse({ ...valid, keyPrefix: ok }).success, ok).toBe(true)
    for (const bad of [
      "/sp",
      "sp/",
      "sp//media",
      "..",
      "sp/../x",
      "sp/./x",
      "SP",
      "sp media",
      "sp.media",
      "x".repeat(65),
    ])
      expect(r2.safeParse({ ...valid, keyPrefix: bad }).success, bad).toBe(
        false
      )
    expect(INTEGRATIONS["integrations.r2"].fields).toContain("keyPrefix")
    expect(INTEGRATIONS["integrations.r2"].secrets).not.toContain("keyPrefix")
  })

  it("turnstile: keys are required only while it is on", () => {
    expect(
      turnstile.safeParse({ enabled: false, siteKey: "", secretKey: "" })
        .success
    ).toBe(true)
    const on = turnstile.safeParse({
      enabled: true,
      siteKey: "",
      secretKey: "",
    })
    expect(on.success).toBe(false)
    expect(on.error!.issues.map((i) => i.path[0]).sort()).toEqual([
      "secretKey",
      "siteKey",
    ])
  })

  it("ai: model and key while on; allowed roles are roles holding ai:use", () => {
    expect(AI_ROLES).not.toContain("viewer")
    expect(AI_ROLES).toContain("editor")
    const base = {
      enabled: true,
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      apiKey: "sk-ant-1234",
      allowedRoles: ["owner", "editor"],
    }
    expect(ai.safeParse(base).success).toBe(true)
    expect(ai.safeParse({ ...base, apiKey: "" }).success).toBe(false)
    expect(ai.safeParse({ ...base, allowedRoles: ["viewer"] }).success).toBe(
      false
    )
    expect(
      ai.safeParse({ ...base, allowedRoles: ["editor", "editor"] }).success
    ).toBe(false)
    expect(
      ai.safeParse({ ...base, enabled: false, model: "", apiKey: "" }).success
    ).toBe(true)
  })
})
