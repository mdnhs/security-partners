import "server-only"

import { createElement } from "react"

import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin, twoFactor } from "better-auth/plugins"
import { createAccessControl } from "better-auth/plugins/access"

import { ResetPasswordEmail } from "@/emails/reset-password"
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/password"
import { hasPermission } from "@/lib/auth/permissions"
import { ROLES, type Role } from "@/lib/auth/roles"
import { type Db, getDb } from "@/server/db/client"
import * as schema from "@/server/db/schema"
import { getEnv } from "@/server/env"
import { mailer } from "@/server/lib/mailer"

import { actorFor, auditAuthEvent, onUserUpdated, securityHooks } from "./hooks"

export const SESSION_EXPIRES_IN = 60 * 60 * 24 * 7 // 7 days (spec §6)
export const IMPERSONATION_EXPIRES_IN = 60 * 60 // 1 hour
export const RESET_TOKEN_EXPIRES_IN = 60 * 60 // forgot-password links: 1 hour

/** Absolute URL of an admin page on the public origin (BETTER_AUTH_URL). */
export function adminUrl(
  path: string,
  params: Record<string, string> = {}
): string {
  const url = new URL(path, getEnv().BETTER_AUTH_URL)
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value)
  return url.toString()
}

/**
 * The admin plugin only needs to know who may impersonate whom; every other
 * admin-plugin endpoint is closed over HTTP (see hooks.ts) and our users
 * service authorises with lib/auth/permissions.ts. Derived from the app
 * matrix: `user:impersonate` → "impersonate"; `owner:manage` →
 * "impersonate-admins" (adminRoles = owner, so only owners impersonate owners).
 */
const pluginAc = createAccessControl({
  user: ["impersonate", "impersonate-admins"],
} as const)

function pluginRole(role: Role) {
  const actions: ("impersonate" | "impersonate-admins")[] = []
  if (hasPermission([role], { user: ["impersonate"] }))
    actions.push("impersonate")
  if (hasPermission([role], { owner: ["manage"] }))
    actions.push("impersonate-admins")
  return pluginAc.newRole({ user: actions })
}

const pluginRoles = Object.fromEntries(
  ROLES.map((role) => [role, pluginRole(role)])
) as Record<Role, ReturnType<typeof pluginRole>>

function createAuth(db: Db) {
  const env = getEnv()
  const origin = new URL(env.BETTER_AUTH_URL).origin
  return betterAuth({
    appName: "Security Partners",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [origin],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
      usePlural: true,
      transaction: true,
    }),
    user: {
      additionalFields: {
        title: { type: "string", required: false, input: true },
      },
    },
    databaseHooks: {
      user: {
        update: {
          // Bylines (spec §5.3): a profile change expires cached articles.
          after: async (_user, context) => onUserUpdated(context),
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: RESET_TOKEN_EXPIRES_IN,
      // Forgot-password: Better Auth creates the token; we link to our page.
      sendResetPassword: async ({ user, token }) => {
        await mailer.send({
          to: user.email,
          subject: "Reset your Security Partners admin password",
          template: "reset-password",
          react: createElement(ResetPasswordEmail, {
            name: user.name,
            url: adminUrl("/admin/reset-password", { token }),
            expiresInMinutes: RESET_TOKEN_EXPIRES_IN / 60,
          }),
        })
      },
      onPasswordReset: async ({ user }, request) => {
        await auditAuthEvent(actorFor(user, request?.headers), {
          action: "auth.password_reset",
          entityType: "user",
          entityId: user.id,
        })
      },
    },
    session: {
      expiresIn: SESSION_EXPIRES_IN,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    rateLimit: {
      // Spec §6: production only, stored in Postgres (rate_limits).
      enabled: env.NODE_ENV === "production",
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/two-factor/*": { window: 60, max: 5 },
        "/request-password-reset": { window: 300, max: 3 },
      },
    },
    advanced: {
      cookiePrefix: "sp",
      // "__Secure-" cookies whenever the public origin is https (production).
      useSecureCookies: origin.startsWith("https:"),
      ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
      database: { generateId: "uuid" },
    },
    plugins: [
      admin({
        ac: pluginAc,
        roles: pluginRoles,
        defaultRole: "viewer",
        adminRoles: ["owner"],
        impersonationSessionDuration: IMPERSONATION_EXPIRES_IN,
        bannedUserMessage: "This account is suspended.",
      }),
      twoFactor({
        issuer: "Security Partners",
        backupCodeOptions: { amount: 10, length: 10 },
      }),
      securityHooks(),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>

let cached: { db: Db; signature: string; auth: Auth } | undefined

/**
 * Lazy, memoised Better Auth instance. Never call at module scope: `next
 * build` has no env. Rebuilt when the DB pool or the auth env changes (tests).
 */
export function getAuth(): Auth {
  const db = getDb()
  const env = getEnv()
  const signature = `${env.BETTER_AUTH_SECRET}\u0000${env.BETTER_AUTH_URL}\u0000${env.NODE_ENV}`
  if (cached?.db === db && cached.signature === signature) return cached.auth
  const auth = createAuth(db)
  cached = { db, signature, auth }
  return auth
}
