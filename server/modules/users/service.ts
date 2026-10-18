import "server-only"

import { isAPIError } from "better-auth/api"
import { createElement } from "react"

import { InviteEmail } from "@/emails/invite"
import { ResetPasswordEmail } from "@/emails/reset-password"
import {
  hasPermission,
  parseRoles,
  type PermissionRequest,
} from "@/lib/auth/permissions"
import type { Role } from "@/lib/auth/roles"
import type { Paginated } from "@/lib/schemas/api/list"
import type {
  BanUserInput,
  InviteUserInput,
  SetRolesInput,
  UpdateUserInput,
  UserListQuery,
} from "@/lib/schemas/api/users"
import { getAuth } from "@/server/auth/auth"
import {
  createPasswordToken,
  INVITE_TOKEN_EXPIRES_IN,
  passwordUrl,
  RECOVERY_TOKEN_EXPIRES_IN,
} from "@/server/auth/tokens"
import { type DbOrTx, getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import { invalidate, tag } from "@/server/lib/cache-tags"
import { AppError, forbidden, notFound } from "@/server/lib/errors"
import { mailer } from "@/server/lib/mailer"

import * as repo from "./repo"
import {
  type InviteResult,
  isBannedNow,
  type PasswordLinkResult,
  toUserItem,
  type UserItem,
  type UserSessionItem,
} from "./schema"

const need = (actor: Actor, req: PermissionRequest) => {
  if (!hasPermission(actor.roles, req)) throw forbidden()
}

const managesOwners = (actor: Actor) =>
  hasPermission(actor.roles, { owner: ["manage"] })

/** Owners are special: only owners may change an owner or grant `owner`. */
function assertMayTouch(actor: Actor, target: repo.UserRow) {
  if (parseRoles(target.role).includes("owner") && !managesOwners(actor))
    throw forbidden()
}

function assertMayAssign(actor: Actor, roles: Role[]) {
  if (roles.includes("owner") && !managesOwners(actor)) throw forbidden()
}

async function loadTarget(db: DbOrTx, id: string) {
  const target = await repo.findUserById(db, id)
  if (!target) throw notFound("User")
  return target
}

/** Same definition as repo.countActiveOwners: has a password, not banned now. */
const isActiveOwner = (row: repo.UserRow) =>
  parseRoles(row.role).includes("owner") && row.hasPassword && !isBannedNow(row)

const DUPLICATE_EMAIL = "A user with this email already exists"

/**
 * Better Auth's "user exists" error, or the users.email unique violation
 * (Postgres 23505, possibly wrapped in `cause`) when two invites race.
 */
function isDuplicateEmailError(err: unknown): boolean {
  if (
    isAPIError(err) &&
    err.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
  )
    return true
  let current: unknown = err
  for (let depth = 0; current && depth < 5; depth++) {
    if ((current as { code?: unknown }).code === "23505") return true
    current = (current as { cause?: unknown }).cause
  }
  return false
}

const impersonates = (roles: readonly string[]) =>
  hasPermission(roles, { user: ["impersonate"] })

/** 409 when `target` is the only active owner (call inside a tx after lockOwners). */
async function assertNotLastOwner(
  tx: DbOrTx,
  target: repo.UserRow,
  verb: string
) {
  if (!isActiveOwner(target)) return
  if ((await repo.countActiveOwners(tx, target.id)) === 0)
    throw new AppError("CONFLICT", `The last active owner cannot be ${verb}`)
}

export async function listUsers(
  actor: Actor,
  query: UserListQuery
): Promise<Paginated<UserItem>> {
  need(actor, { user: ["read"] })
  const { rows, total } = await repo.listUsers(getDb(), {
    filters: {
      role: query.role,
      status: query.status,
      q: query.q || undefined,
    },
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  })
  return {
    items: rows.map(toUserItem),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function getUser(actor: Actor, id: string): Promise<UserItem> {
  need(actor, { user: ["read"] })
  return toUserItem(await loadTarget(getDb(), id))
}

export async function inviteUser(
  actor: Actor,
  input: InviteUserInput
): Promise<InviteResult> {
  need(actor, { user: ["invite"] })
  assertMayAssign(actor, input.roles)
  const db = getDb()
  if (await repo.findUserByEmail(db, input.email))
    throw new AppError("CONFLICT", DUPLICATE_EMAIL)

  let user: { id: string }
  try {
    ;({ user } = await getAuth().api.createUser({
      body: {
        email: input.email,
        name: input.name,
        role: input.roles,
        data: { title: input.title ?? null },
      },
    }))
  } catch (err) {
    if (isDuplicateEmailError(err))
      throw new AppError("CONFLICT", DUPLICATE_EMAIL)
    throw err
  }
  const token = await createPasswordToken(user.id, INVITE_TOKEN_EXPIRES_IN)
  const inviteUrl = passwordUrl("set-password", token)
  // Audit before the mail step: the invite exists whether or not email works.
  await writeAudit(db, actor, {
    action: "user.invite",
    entityType: "user",
    entityId: user.id,
    diff: {
      email: input.email,
      roles: input.roles,
      title: input.title ?? null,
    },
  })
  const { delivered } = await sendInviteEmail(db, actor, {
    to: input.email,
    name: input.name,
    url: inviteUrl,
    expiresInSeconds: INVITE_TOKEN_EXPIRES_IN,
  })
  const created = await loadTarget(db, user.id)
  return { user: toUserItem(created), inviteUrl, emailDelivered: delivered }
}

/** Invite wording ("X invited you … choose a password"); mail failure → delivered: false. */
async function sendInviteEmail(
  db: DbOrTx,
  actor: Actor,
  msg: { to: string; name: string; url: string; expiresInSeconds: number }
) {
  const inviter = await repo.findUserById(db, actor.userId)
  return mailer.send({
    to: msg.to,
    subject: "You're invited to the Security Partners admin",
    template: "invite",
    react: createElement(InviteEmail, {
      name: msg.name,
      inviterName: inviter?.name ?? "An administrator",
      url: msg.url,
      expiresInDays: msg.expiresInSeconds / 86_400,
    }),
  })
}

export async function updateUser(
  actor: Actor,
  id: string,
  input: UpdateUserInput
): Promise<UserItem> {
  need(actor, { user: ["update"] })
  const db = getDb()
  const target = await loadTarget(db, id)
  assertMayTouch(actor, target)
  await db.transaction(async (tx) => {
    await repo.updateUserProfile(tx, id, input)
    await writeAudit(tx, actor, {
      action: "user.update",
      entityType: "user",
      entityId: id,
      diff: {
        from: { name: target.name, title: target.title },
        to: input,
      },
    })
  })
  // Article bylines show users.name / users.title (spec §5.3).
  invalidate(tag.articles)
  return toUserItem(await loadTarget(db, id))
}

export async function setRoles(
  actor: Actor,
  id: string,
  input: SetRolesInput
): Promise<UserItem> {
  need(actor, { user: ["update"] })
  assertMayAssign(actor, input.roles)
  const db = getDb()
  await db.transaction(async (tx) => {
    await repo.lockOwners(tx)
    const target = await loadTarget(tx, id)
    assertMayTouch(actor, target)
    if (!input.roles.includes("owner"))
      await assertNotLastOwner(tx, target, "demoted")
    const from = parseRoles(target.role)
    await repo.setUserRoles(tx, id, input.roles)
    const revoked: Record<string, number> = {}
    if (input.roles.includes("owner") && !from.includes("owner")) {
      // New owner: links and "View as" sessions issued while they were not
      // an owner (by non-owners) must not grant owner access.
      revoked.passwordLinksRevoked = await repo.deletePasswordTokens(tx, id)
      revoked.impersonationsRevoked = await repo.deleteImpersonationSessionsOf(
        tx,
        id
      )
    }
    if (impersonates(from) && !impersonates(input.roles))
      revoked.sessionsRevoked = await repo.deleteUserSessions(tx, id)
    await writeAudit(tx, actor, {
      action: "user.roles_change",
      entityType: "user",
      entityId: id,
      diff: { from, to: input.roles, ...revoked },
    })
  })
  return toUserItem(await loadTarget(db, id))
}

export async function banUser(
  actor: Actor,
  id: string,
  input: BanUserInput
): Promise<UserItem> {
  need(actor, { user: ["ban"] })
  const db = getDb()
  await db.transaction(async (tx) => {
    await repo.lockOwners(tx)
    const target = await loadTarget(tx, id)
    assertMayTouch(actor, target)
    await assertNotLastOwner(tx, target, "banned")
    if (target.id === actor.userId)
      throw new AppError("CONFLICT", "You cannot ban your own account")
    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 86_400_000)
      : null
    await repo.setUserBan(tx, id, { reason: input.reason ?? null, expiresAt })
    const revoked = await repo.deleteUserSessions(tx, id)
    await writeAudit(tx, actor, {
      action: "user.ban",
      entityType: "user",
      entityId: id,
      diff: {
        reason: input.reason ?? null,
        expiresAt: expiresAt?.toISOString() ?? null,
        sessionsRevoked: revoked,
      },
    })
  })
  return toUserItem(await loadTarget(db, id))
}

export async function unbanUser(actor: Actor, id: string): Promise<UserItem> {
  need(actor, { user: ["ban"] })
  const db = getDb()
  const target = await loadTarget(db, id)
  assertMayTouch(actor, target)
  await db.transaction(async (tx) => {
    await repo.setUserBan(tx, id, null)
    await writeAudit(tx, actor, {
      action: "user.unban",
      entityType: "user",
      entityId: id,
    })
  })
  return toUserItem(await loadTarget(db, id))
}

export async function listSessions(
  actor: Actor,
  id: string
): Promise<UserSessionItem[]> {
  need(actor, { user: ["read"] })
  const db = getDb()
  const target = await loadTarget(db, id)
  assertMayTouch(actor, target)
  const rows = await repo.listUserSessions(db, id)
  return rows.map((s) => ({
    id: s.id,
    ipAddress: s.ipAddress,
    userAgent: s.userAgent,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    impersonatedBy: s.impersonatedBy,
  }))
}

export async function revokeSessions(
  actor: Actor,
  id: string
): Promise<{ revoked: number }> {
  need(actor, { user: ["revokeSessions"] })
  const db = getDb()
  const target = await loadTarget(db, id)
  assertMayTouch(actor, target)
  return db.transaction(async (tx) => {
    const revoked = await repo.deleteUserSessions(tx, id)
    await writeAudit(tx, actor, {
      action: "user.sessions_revoke",
      entityType: "user",
      entityId: id,
      diff: { revoked },
    })
    return { revoked }
  })
}

/**
 * Single-use link to choose a password: "set-password" for invited users,
 * "reset-password" otherwise. Emailed when SMTP works; always returned so an
 * admin can pass it on when it does not (spec §17 bootstrap without SMTP).
 */
export async function createPasswordLink(
  actor: Actor,
  id: string
): Promise<PasswordLinkResult> {
  need(actor, { user: ["update"] })
  const db = getDb()
  const target = await loadTarget(db, id)
  assertMayTouch(actor, target)
  if (isBannedNow(target))
    throw new AppError(
      "CONFLICT",
      "Unban this user before sending a password link"
    )
  // Only the newest link works: earlier invite/reset links stop working.
  const revoked = await repo.deletePasswordTokens(db, id)
  const token = await createPasswordToken(id, RECOVERY_TOKEN_EXPIRES_IN)
  const url = passwordUrl(
    target.hasPassword ? "reset-password" : "set-password",
    token
  )
  await writeAudit(db, actor, {
    action: "user.password_link",
    entityType: "user",
    entityId: id,
    diff: { passwordLinksRevoked: revoked },
  })
  const { delivered } = target.hasPassword
    ? await mailer.send({
        to: target.email,
        subject: "Reset your Security Partners admin password",
        template: "reset-password",
        react: createElement(ResetPasswordEmail, {
          name: target.name,
          url,
          expiresInMinutes: RECOVERY_TOKEN_EXPIRES_IN / 60,
        }),
      })
    : await sendInviteEmail(db, actor, {
        to: target.email,
        name: target.name,
        url,
        expiresInSeconds: RECOVERY_TOKEN_EXPIRES_IN,
      })
  return { url, emailDelivered: delivered }
}

/**
 * "View as": Better Auth's admin plugin creates a 1-hour session for the
 * target with impersonatedBy = actor, and keeps the actor's own session in a
 * signed admin_session cookie. Returns the Set-Cookie headers to forward.
 */
export async function startImpersonation(
  actor: Actor,
  id: string,
  requestHeaders: Headers
): Promise<{ user: UserItem; expiresAt: string; headers: Headers }> {
  need(actor, { user: ["impersonate"] })
  if (actor.impersonatorId)
    throw new AppError("CONFLICT", "Stop the current impersonation first")
  if (id === actor.userId)
    throw new AppError("VALIDATION_FAILED", "You cannot impersonate yourself")
  const db = getDb()
  const target = await loadTarget(db, id)
  assertMayTouch(actor, target)
  if (isBannedNow(target))
    throw new AppError("CONFLICT", "This user is suspended")
  const { headers, response } = await getAuth().api.impersonateUser({
    body: { userId: id },
    headers: requestHeaders,
    returnHeaders: true,
  })
  await writeAudit(db, actor, {
    action: "user.impersonate_start",
    entityType: "user",
    entityId: id,
    diff: { expiresAt: new Date(response.session.expiresAt).toISOString() },
  })
  return {
    user: toUserItem(target),
    expiresAt: new Date(response.session.expiresAt).toISOString(),
    headers,
  }
}

/** Ends "View as" and restores the impersonator's own session. */
export async function stopImpersonation(
  actor: Actor,
  requestHeaders: Headers
): Promise<{ headers: Headers }> {
  if (!actor.impersonatorId)
    throw new AppError("CONFLICT", "You are not impersonating anyone")
  const { headers } = await getAuth().api.stopImpersonating({
    headers: requestHeaders,
    returnHeaders: true,
  })
  await writeAudit(
    getDb(),
    { ...actor, userId: actor.impersonatorId, roles: [], impersonatorId: null },
    {
      action: "user.impersonate_stop",
      entityType: "user",
      entityId: actor.userId,
    }
  )
  return { headers }
}
