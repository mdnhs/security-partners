import { describe, expect, it } from "vitest"

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/password"
import { authErrorMessage } from "@/lib/auth-client"

describe("authErrorMessage", () => {
  it("uses the password length constants", () => {
    expect(authErrorMessage({ code: "PASSWORD_TOO_SHORT" })).toBe(
      `Use at least ${PASSWORD_MIN_LENGTH} characters.`
    )
    expect(authErrorMessage({ code: "PASSWORD_TOO_LONG" })).toBe(
      `Use at most ${PASSWORD_MAX_LENGTH} characters.`
    )
  })

  it("tells TOTP and backup-code failures apart", () => {
    expect(authErrorMessage({ code: "INVALID_CODE" })).toContain(
      "authenticator app"
    )
    const backup = authErrorMessage({ code: "INVALID_BACKUP_CODE" })
    expect(backup).toContain("backup code")
    expect(backup).not.toContain("authenticator")
  })

  it("puts 429 before the code and falls back for unknown errors", () => {
    expect(
      authErrorMessage({ status: 429, code: "INVALID_EMAIL_OR_PASSWORD" })
    ).toBe("Too many attempts. Wait a minute and try again.")
    expect(authErrorMessage(null)).toBe("Something went wrong. Try again.")
    expect(authErrorMessage({})).toBe("Something went wrong. Try again.")
  })
})
