import "server-only"

import { randomBytes } from "node:crypto"

import { adminUrl, getAuth } from "./auth"

export const INVITE_TOKEN_EXPIRES_IN = 60 * 60 * 24 * 7 // 7 days
export const RECOVERY_TOKEN_EXPIRES_IN = 60 * 60 * 24 // 24 hours

/** A single-use password-link token (24 random bytes, URL-safe). */
export function newPasswordToken(): string {
  return randomBytes(24).toString("base64url")
}

/**
 * Creates a Better Auth password-reset token for `userId` (the same
 * `reset-password:<token>` verification row that /request-password-reset
 * writes), so POST /api/auth/reset-password { token, newPassword } sets the
 * password and creates the credential account for passwordless users.
 */
export async function createPasswordToken(
  userId: string,
  expiresInSeconds: number
): Promise<string> {
  const ctx = await getAuth().$context
  const token = newPasswordToken()
  await ctx.internalAdapter.createVerificationValue({
    value: userId,
    identifier: `reset-password:${token}`,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
  })
  return token
}

/** Absolute admin URL that lets the holder of `token` choose a password. */
export function passwordUrl(
  page: "set-password" | "reset-password",
  token: string
): string {
  return adminUrl(`/admin/${page}`, { token })
}
