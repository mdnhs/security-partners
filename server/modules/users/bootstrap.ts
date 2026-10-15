import "server-only"

import { createElement } from "react"
import { z } from "zod"

import { InviteEmail } from "@/emails/invite"
import { ResetPasswordEmail } from "@/emails/reset-password"
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/password"
import { parseRoles } from "@/lib/auth/permissions"
import { ROLES, type Role } from "@/lib/auth/roles"
import { getAuth } from "@/server/auth/auth"
import {
  createPasswordToken,
  INVITE_TOKEN_EXPIRES_IN,
  passwordUrl,
  RECOVERY_TOKEN_EXPIRES_IN,
} from "@/server/auth/tokens"
import { getDb } from "@/server/db/client"
import { writeAudit } from "@/server/lib/audit"
import { AppError, notFound } from "@/server/lib/errors"
import { mailer } from "@/server/lib/mailer"

import * as repo from "./repo"

// Operator commands (scripts/admin-create.ts, owner-recover.ts,
// demo-seed.ts). They run with database access only, so there is no actor:
// audit rows have actorId null and record the command in `diff.via`.

export type LinkResult = {
  userId: string
  url: string
  emailDelivered: boolean
}

const emailSchema = z.email().max(254)

/** Inviter shown in invite emails sent by an operator command. */
const OPERATOR_NAME = "Security Partners"

function normaliseEmail(value: string): string {
  const email = value.trim().toLowerCase()
  if (!emailSchema.safeParse(email).success)
    throw new AppError(
      "VALIDATION_FAILED",
      `Not a valid email address: ${value}`
    )
  return email
}

/** Invite wording ("… choose a password") for an account without a password. */
function sendInviteEmail(msg: {
  to: string
  name: string
  url: string
  expiresInSeconds: number
}) {
  return mailer.send({
    to: msg.to,
    subject: "You're invited to the Security Partners admin",
    react: createElement(InviteEmail, {
      name: msg.name,
      inviterName: OPERATOR_NAME,
      url: msg.url,
      expiresInDays: msg.expiresInSeconds / 86_400,
    }),
  })
}

/** admin:create: a new owner without a password, plus a set-password link. */
export async function createOwner(input: {
  email: string
  name: string
}): Promise<LinkResult> {
  const email = normaliseEmail(input.email)
  const name = input.name.trim()
  if (!name) throw new AppError("VALIDATION_FAILED", "A name is required")
  const db = getDb()
  if (await repo.findUserByEmail(db, email))
    throw new AppError(
      "CONFLICT",
      `A user with email ${email} already exists (locked-out owner? use owner:recover)`
    )
  const { user } = await getAuth().api.createUser({
    body: { email, name, role: ["owner"] },
  })
  const url = passwordUrl(
    "set-password",
    await createPasswordToken(user.id, INVITE_TOKEN_EXPIRES_IN)
  )
  await writeAudit(db, null, {
    action: "user.invite",
    entityType: "user",
    entityId: user.id,
    diff: { email, roles: ["owner"], via: "admin:create" },
  })
  const { delivered } = await sendInviteEmail({
    to: email,
    name,
    url,
    expiresInSeconds: INVITE_TOKEN_EXPIRES_IN,
  })
  return { userId: user.id, url, emailDelivered: delivered }
}

/**
 * owner:recover: for an owner locked out (lost 2FA device or password).
 * Under the owners lock (so a concurrent demotion cannot interleave): turns
 * 2FA off, signs out every session (own and impersonation), voids older
 * password links, then issues a 24-hour password link.
 */
export async function recoverOwner(input: {
  email: string
}): Promise<LinkResult> {
  const email = normaliseEmail(input.email)
  const db = getDb()
  const target = await db.transaction(async (tx) => {
    await repo.lockOwners(tx)
    const found = await repo.findUserByEmail(tx, email)
    if (!found) throw notFound("User")
    if (!parseRoles(found.role).includes("owner"))
      throw new AppError("VALIDATION_FAILED", `${email} is not an owner`)
    await repo.clearTwoFactor(tx, found.id)
    const revoked = await repo.deleteUserSessions(tx, found.id)
    const linksRevoked = await repo.deletePasswordTokens(tx, found.id)
    await writeAudit(tx, null, {
      action: "user.owner_recover",
      entityType: "user",
      entityId: found.id,
      diff: {
        via: "owner:recover",
        twoFactorCleared: !!found.twoFactorEnabled,
        sessionsRevoked: revoked,
        passwordLinksRevoked: linksRevoked,
      },
    })
    return found
  })
  const url = passwordUrl(
    target.hasPassword ? "reset-password" : "set-password",
    await createPasswordToken(target.id, RECOVERY_TOKEN_EXPIRES_IN)
  )
  const { delivered } = target.hasPassword
    ? await mailer.send({
        to: email,
        subject: "Recover your Security Partners admin account",
        react: createElement(ResetPasswordEmail, {
          name: target.name,
          url,
          expiresInMinutes: RECOVERY_TOKEN_EXPIRES_IN / 60,
        }),
      })
    : await sendInviteEmail({
        to: email,
        name: target.name,
        url,
        expiresInSeconds: RECOVERY_TOKEN_EXPIRES_IN,
      })
  return { userId: target.id, url, emailDelivered: delivered }
}

export const DEMO_EMAIL_DOMAIN = "demo.local"

export type DemoUser = { email: string; role: Role; created: boolean }

/**
 * demo:seed: one account per role, `<role>@demo.local`, all with `password`.
 * Idempotent: existing demo accounts get their single role, name and
 * password back, are unbanned and have 2FA turned off.
 */
export async function seedDemoUsers(password: string): Promise<DemoUser[]> {
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  )
    throw new AppError(
      "VALIDATION_FAILED",
      `--password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters`
    )
  const auth = getAuth()
  const ctx = await auth.$context
  const hash = await ctx.password.hash(password)
  const db = getDb()
  const result: DemoUser[] = []
  for (const role of ROLES) {
    const email = `${role}@${DEMO_EMAIL_DOMAIN}`
    const name = `Demo ${role.charAt(0).toUpperCase()}${role.slice(1)}`
    const existing = await repo.findUserByEmail(db, email)
    let userId: string
    if (existing) {
      userId = existing.id
      await repo.updateUserProfile(db, userId, { name, title: null })
      await repo.setUserRoles(db, userId, [role])
      await repo.setUserBan(db, userId, null)
      await repo.clearTwoFactor(db, userId)
    } else {
      const { user } = await auth.api.createUser({
        body: { email, name, role: [role] },
      })
      userId = user.id
    }
    if (await ctx.internalAdapter.findCredentialAccount(userId))
      await ctx.internalAdapter.updatePassword(userId, hash)
    else
      await ctx.internalAdapter.createAccount({
        userId,
        providerId: "credential",
        accountId: userId,
        password: hash,
      })
    result.push({ email, role, created: !existing })
  }
  return result
}
