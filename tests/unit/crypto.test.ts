import { afterEach, describe, expect, it, vi } from "vitest"

import {
  decryptSecret,
  deriveKey,
  encryptSecret,
  secretHint,
} from "@/server/lib/crypto"

const SECRET = "test-secret-0123456789abcdef0123456789abcdef"
const OTHER = "other-secret-0123456789abcdef0123456789abcdef"
const AAD = "integrations.smtp.password"

describe("deriveKey", () => {
  it("is deterministic per purpose and 32 bytes long", () => {
    expect(
      deriveKey("secrets", SECRET).equals(deriveKey("secrets", SECRET))
    ).toBe(true)
    expect(deriveKey("secrets", SECRET)).toHaveLength(32)
  })

  it("differs across purposes and secrets", () => {
    const keys = (["secrets", "preview", "lead-ip", "cron"] as const).map((p) =>
      deriveKey(p, SECRET).toString("hex")
    )
    expect(new Set(keys).size).toBe(4)
    expect(
      deriveKey("secrets", OTHER).equals(deriveKey("secrets", SECRET))
    ).toBe(false)
  })

  describe("with env vars", () => {
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it("defaults to BETTER_AUTH_SECRET from the env", () => {
      vi.stubEnv("DATABASE_URL", "postgres://sp:sp@127.0.0.1:5432/sp_test")
      vi.stubEnv("BETTER_AUTH_SECRET", SECRET)
      vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000")
      expect(deriveKey("preview").equals(deriveKey("preview", SECRET))).toBe(
        true
      )
    })
  })

  it("rejects an explicit secret that is empty or shorter than 32 characters", () => {
    for (const bad of ["", "short", "x".repeat(31)]) {
      expect(() => deriveKey("secrets", bad)).toThrow(
        "Secret must be at least 32 characters"
      )
    }
    expect(deriveKey("secrets", "x".repeat(32))).toHaveLength(32)
  })
})

describe("explicit secret validation", () => {
  it("encryptSecret and decryptSecret reject a short explicit secret", () => {
    const token = encryptSecret("value", AAD, SECRET)
    expect(() => encryptSecret("value", AAD, "too-short")).toThrow(
      "Secret must be at least 32 characters"
    )
    expect(() => decryptSecret(token, AAD, "")).toThrow(
      "Secret must be at least 32 characters"
    )
  })

  it("does not mask missing env config as a decryption failure", () => {
    const token = encryptSecret("value", AAD, SECRET)
    expect(() => decryptSecret(token, AAD)).toThrow(
      "Invalid environment configuration"
    )
  })
})

describe("encryptSecret / decryptSecret", () => {
  it("round-trips, including unicode", () => {
    for (const plain of ["smtp-pass", "", "pässwörd ☂ – Dinn Rí"]) {
      expect(
        decryptSecret(encryptSecret(plain, AAD, SECRET), AAD, SECRET)
      ).toBe(plain)
    }
  })

  it('formats as "v1:<iv>:<ciphertext>:<tag>" with base64url parts and a fresh IV', () => {
    const a = encryptSecret("value", AAD, SECRET)
    const b = encryptSecret("value", AAD, SECRET)
    const parts = a.split(":")
    expect(parts).toHaveLength(4)
    expect(parts[0]).toBe("v1")
    for (const part of parts.slice(1)) expect(part).toMatch(/^[A-Za-z0-9_-]*$/)
    expect(Buffer.from(parts[1], "base64url")).toHaveLength(12)
    expect(Buffer.from(parts[3], "base64url")).toHaveLength(16)
    expect(a).not.toBe(b)
  })

  it("throws with a different AAD", () => {
    const token = encryptSecret("value", AAD, SECRET)
    expect(() =>
      decryptSecret(token, "integrations.r2.secretAccessKey", SECRET)
    ).toThrow()
  })

  it("throws with a different secret", () => {
    const token = encryptSecret("value", AAD, SECRET)
    expect(() => decryptSecret(token, AAD, OTHER)).toThrow()
  })

  it("throws when the ciphertext or tag is tampered with", () => {
    const [v, iv, ct, tag] = encryptSecret(
      "value-to-protect",
      AAD,
      SECRET
    ).split(":")
    const flip = (b64: string) => {
      const buf = Buffer.from(b64, "base64url")
      buf[0] ^= 0xff
      return buf.toString("base64url")
    }
    expect(() =>
      decryptSecret([v, iv, flip(ct), tag].join(":"), AAD, SECRET)
    ).toThrow()
    expect(() =>
      decryptSecret([v, iv, ct, flip(tag)].join(":"), AAD, SECRET)
    ).toThrow()
  })

  it("throws on malformed tokens", () => {
    expect(() => decryptSecret("plaintext", AAD, SECRET)).toThrow(
      "Malformed encrypted secret"
    )
    expect(() => decryptSecret("v2:a:b:c", AAD, SECRET)).toThrow(
      "Malformed encrypted secret"
    )
    expect(() => decryptSecret("v1:a:b", AAD, SECRET)).toThrow(
      "Malformed encrypted secret"
    )
  })

  it("rejects a truncated tag or a wrong-length IV as malformed", () => {
    const [v, iv, ct, tag] = encryptSecret("value", AAD, SECRET).split(":")
    const truncate = (b64: string, bytes: number) =>
      Buffer.from(b64, "base64url").subarray(0, bytes).toString("base64url")
    const extend = (b64: string) =>
      Buffer.concat([Buffer.from(b64, "base64url"), Buffer.alloc(4)]).toString(
        "base64url"
      )
    for (const token of [
      [v, iv, ct, truncate(tag, 6)],
      [v, truncate(iv, 8), ct, tag],
      [v, extend(iv), ct, tag],
      [v, "", ct, tag],
    ]) {
      expect(() => decryptSecret(token.join(":"), AAD, SECRET)).toThrow(
        "Malformed encrypted secret"
      )
    }
  })

  it("rejects parts that are not strict base64url", () => {
    const [v, iv, ct, tag] = encryptSecret("value", AAD, SECRET).split(":")
    for (const token of [
      [v, `${iv}=`, ct, tag],
      [v, iv, `${ct}+`, tag],
      [v, iv, ct, `${tag}/`],
      [v, iv, ct, ` ${tag}`],
    ]) {
      expect(() => decryptSecret(token.join(":"), AAD, SECRET)).toThrow(
        "Malformed encrypted secret"
      )
    }
  })
})

describe("secretHint", () => {
  it('returns "••••" + the last 4 characters', () => {
    expect(secretHint("sk-live-abcd1234")).toBe("••••1234")
  })

  it("gives no hint for secrets under 12 characters", () => {
    expect(secretHint("abcd1234567")).toBeNull()
    expect(secretHint("abcd")).toBeNull()
    expect(secretHint("")).toBeNull()
    expect(secretHint("abcd12345678")).toBe("••••5678")
  })
})
