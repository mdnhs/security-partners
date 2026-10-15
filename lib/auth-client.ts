import {
  inferAdditionalFields,
  twoFactorClient,
} from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/password"

/**
 * Browser client for /api/auth (same origin). Admin-plugin endpoints are not
 * exposed over HTTP; user management goes through /api/v1/admin/users.
 */
export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [
    twoFactorClient(),
    inferAdditionalFields({
      user: { title: { type: "string", required: false } },
    }),
  ],
})

/** Readable messages for Better Auth error codes shown on the admin auth pages. */
export function authErrorMessage(
  error: { status?: number; code?: string; message?: string } | null | undefined
): string {
  if (!error) return "Something went wrong. Try again."
  if (error.status === 429)
    return "Too many attempts. Wait a minute and try again."
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Email or password is incorrect."
    case "BANNED_USER":
      return "This account is suspended. Contact an administrator."
    case "INVALID_CODE":
      return "That code is not valid. Check your authenticator app and try again."
    case "INVALID_BACKUP_CODE":
      return "That backup code is not valid or was already used. Try another one."
    case "INVALID_TWO_FACTOR_COOKIE":
    case "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE":
      return "Your sign-in expired. Sign in again."
    case "ACCOUNT_TEMPORARILY_LOCKED":
      return "Too many wrong codes. Two-factor sign-in is locked for 15 minutes."
    case "INVALID_TOKEN":
      return "This link has expired or was already used. Ask an administrator for a new one."
    case "PASSWORD_TOO_SHORT":
      return `Use at least ${PASSWORD_MIN_LENGTH} characters.`
    case "PASSWORD_TOO_LONG":
      return `Use at most ${PASSWORD_MAX_LENGTH} characters.`
    case "INVALID_PASSWORD":
      return "Your current password is incorrect."
    default:
      return error.message || "Something went wrong. Try again."
  }
}
