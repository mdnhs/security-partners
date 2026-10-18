import "server-only"

import type { BetterAuthPlugin } from "better-auth"
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
  isAPIError,
} from "better-auth/api"
import { z } from "zod"

import { parseRoles } from "@/lib/auth/permissions"
import { selfProfileInput } from "@/lib/schemas/api/users"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { type AuditEntry, writeAudit } from "@/server/lib/audit"
import { invalidate, tag } from "@/server/lib/cache-tags"
import { clientIp } from "@/server/lib/ip"

type AuthUser = { id: string; role?: string | null }

export function actorFor(
  user: AuthUser,
  headers: Headers | undefined,
  impersonatedBy: string | null = null
): Actor {
  return {
    userId: user.id,
    roles: parseRoles(user.role),
    ip: headers ? clientIp(headers) : null,
    userAgent: headers?.get("user-agent") ?? null,
    impersonatorId: impersonatedBy,
  }
}

/** Audit must never break authentication: failures are logged, not thrown. */
export async function auditAuthEvent(
  actor: Actor | null,
  entry: AuditEntry
): Promise<void> {
  try {
    await writeAudit(getDb(), actor, entry)
  } catch (err) {
    console.error(
      `[audit] could not record ${entry.action}:`,
      err instanceof Error ? err.message : String(err)
    )
  }
}

const SECOND_FACTOR_PATHS = new Set([
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
])

const isOk = (returned: unknown) => !isAPIError(returned)

/** RFC 5321 path limit: longest address worth keeping in an audit row. */
const EMAIL_MAX_LENGTH = 254
const emailShape = z.email()

/**
 * The address typed into a failed sign-in, for the audit diff: lower-cased,
 * at most 254 chars, and only when it is an email at all (anything else is
 * attacker-controlled noise and is recorded as `emailInvalid: true`).
 */
function attemptedEmail(
  raw: unknown
): { email: string } | { emailInvalid: true } {
  const email =
    typeof raw === "string"
      ? raw.trim().toLowerCase().slice(0, EMAIL_MAX_LENGTH)
      : ""
  return emailShape.safeParse(email).success
    ? { email }
    : { emailInvalid: true }
}

/** Better Auth endpoints that change a byline (users.name / users.title). */
const BYLINE_PATHS: ReadonlySet<string> = new Set(["/update-user"])

/**
 * Article bylines are the author's profile (spec §5.3), cached under the
 * `articles` tag: a profile change expires it. Never breaks the auth
 * request — outside a Next request (scripts) revalidateTag throws, which is
 * logged here, not rethrown.
 */
export async function onUserUpdated(
  context: { path?: string } | null
): Promise<void> {
  if (!context?.path || !BYLINE_PATHS.has(context.path)) return
  try {
    invalidate(tag.articles)
  } catch (err) {
    console.error(
      "[cache] could not expire articles after a profile change:",
      err instanceof Error ? err.message : String(err)
    )
  }
}

/** Better Auth's pending-challenge cookie (`<prefix>.two_factor`). */
const TWO_FACTOR_COOKIE = "two_factor"

/**
 * Account-changing (or password-probing / secret-revealing) endpoints an
 * impersonation session may not call.
 */
export const SELF_SERVICE_PATHS: ReadonlySet<string> = new Set([
  "/change-password",
  "/verify-password",
  "/update-user",
  "/change-email",
  "/delete-user",
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/generate-backup-codes",
  "/two-factor/get-totp-uri",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
  "/unlink-account",
  "/link-social",
  // Reads: the target's session tokens, IPs and linked accounts (final
  // review M4).
  "/list-sessions",
  "/list-accounts",
])

/**
 * Project hooks for Better Auth, packaged as a plugin so they run after the
 * twoFactor plugin's hooks (plugin hooks run in plugin order; options.hooks
 * would run first and see a sign-in that twoFactor later turns into a
 * challenge).
 */
export function securityHooks(): BetterAuthPlugin {
  return {
    id: "sp-security",
    hooks: {
      before: [
        {
          // Admin-plugin endpoints are server-only: user management goes
          // through /api/v1/admin/users (permission checks + audit). Direct
          // HTTP calls to /api/auth/admin/* are refused; auth.api.* calls
          // from our own services carry no `request` and pass.
          matcher: (ctx) => ctx.path?.startsWith("/admin/") ?? false,
          handler: createAuthMiddleware(async (ctx) => {
            if (ctx.request) throw new APIError("NOT_FOUND")
          }),
        },
        {
          // "View as" must not change the impersonated person's credentials.
          matcher: (ctx) => SELF_SERVICE_PATHS.has(ctx.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            const session = await getSessionFromCtx(ctx)
            if (session?.session.impersonatedBy)
              throw new APIError("FORBIDDEN", {
                message: "Account settings are disabled while impersonating",
              })
          }),
        },
        {
          // Own profile edits follow the admin API's name/title rules
          // (final review M1): trimmed, 1–100 / 0–100 chars. Only the
          // fields sent are checked. The trimmed name replaces the input;
          // the title is normalised (blank → null) by its additionalFields
          // validator, since a hook's null would not override the body.
          matcher: (ctx) => ctx.path === "/update-user",
          handler: createAuthMiddleware(async (ctx) => {
            const body = (ctx.body ?? {}) as Record<string, unknown>
            const parsed = selfProfileInput.safeParse({
              name: body.name,
              title: body.title,
            })
            if (!parsed.success) {
              const issue = parsed.error.issues[0]
              throw new APIError("BAD_REQUEST", {
                message: `${String(issue?.path[0] ?? "body")}: ${issue?.message ?? "invalid"}`,
              })
            }
            if (parsed.data.name === undefined) return
            return { context: { body: { ...body, name: parsed.data.name } } }
          }),
        },
        {
          // Changing the password always signs out every other device.
          matcher: (ctx) => ctx.path === "/change-password",
          handler: createAuthMiddleware(async (ctx) => ({
            context: { body: { ...ctx.body, revokeOtherSessions: true } },
          })),
        },
        {
          // Sign-out: record who before the session is deleted.
          matcher: (ctx) => ctx.path === "/sign-out",
          handler: createAuthMiddleware(async (ctx) => {
            const session = await getSessionFromCtx(ctx)
            if (!session) return
            await auditAuthEvent(
              actorFor(
                session.user,
                ctx.headers,
                session.session.impersonatedBy ?? null
              ),
              {
                action: "auth.sign_out",
                entityType: "user",
                entityId: session.user.id,
              }
            )
          }),
        },
      ],
      after: [
        {
          matcher: (ctx) => ctx.path === "/sign-in/email",
          handler: createAuthMiddleware(async (ctx) => {
            const headers = ctx.headers
            const created = ctx.context.newSession
            if (created) {
              await auditAuthEvent(actorFor(created.user, headers), {
                action: "auth.sign_in",
                entityType: "user",
                entityId: created.user.id,
                diff: { method: "password" },
              })
              return
            }
            const returned = ctx.context.returned
            if (!isAPIError(returned)) return // two-factor challenge pending
            const attempted = attemptedEmail(ctx.body?.email)
            const found =
              "email" in attempted
                ? await ctx.context.internalAdapter.findUserByEmail(
                    attempted.email
                  )
                : null
            await auditAuthEvent(null, {
              action: "auth.sign_in_failed",
              entityType: "user",
              entityId: found?.user.id,
              diff: {
                method: "password",
                ...attempted,
                reason: returned.body?.code ?? null,
              },
              ip: headers ? clientIp(headers) : null,
              userAgent: headers?.get("user-agent") ?? null,
            })
          }),
        },
        {
          matcher: (ctx) => SECOND_FACTOR_PATHS.has(ctx.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            const headers = ctx.headers
            const method = ctx.path.endsWith("totp") ? "totp" : "backup_code"
            // verifyTwoFactor() stores the pre-existing session here; null
            // means this call completes a sign-in challenge.
            const prior = ctx.context.session
            const created = ctx.context.newSession
            if (!prior && created) {
              await auditAuthEvent(actorFor(created.user, headers), {
                action: "auth.sign_in",
                entityType: "user",
                entityId: created.user.id,
                diff: { method },
              })
            } else if (prior && created && method === "totp") {
              // first successful code while signed in turns 2FA on
              await auditAuthEvent(actorFor(prior.user, headers), {
                action: "auth.2fa_enable",
                entityType: "user",
                entityId: prior.user.id,
              })
            } else if (!prior && isAPIError(ctx.context.returned)) {
              // The challenged account: the signed two_factor cookie names a
              // verification row whose value is the user id (still present
              // after a wrong code; consumed only on success or lockout).
              const challenge = await ctx.getSignedCookie(
                ctx.context.createAuthCookie(TWO_FACTOR_COOKIE).name,
                ctx.context.secret
              )
              const pending = challenge
                ? await ctx.context.internalAdapter.findVerificationValue(
                    challenge
                  )
                : null
              await auditAuthEvent(null, {
                action: "auth.sign_in_failed",
                entityType: "user",
                entityId: pending?.value || undefined,
                diff: {
                  method,
                  reason: ctx.context.returned.body?.code ?? null,
                },
                ip: headers ? clientIp(headers) : null,
                userAgent: headers?.get("user-agent") ?? null,
              })
            }
          }),
        },
        {
          matcher: (ctx) =>
            ctx.path === "/two-factor/disable" ||
            ctx.path === "/change-password",
          handler: createAuthMiddleware(async (ctx) => {
            const session = ctx.context.session
            if (!session || !isOk(ctx.context.returned)) return
            await auditAuthEvent(
              actorFor(
                session.user,
                ctx.headers,
                session.session.impersonatedBy ?? null
              ),
              {
                action:
                  ctx.path === "/change-password"
                    ? "auth.password_change"
                    : "auth.2fa_disable",
                entityType: "user",
                entityId: session.user.id,
              }
            )
          }),
        },
      ],
    },
  }
}
