import "server-only"

import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  ne,
  not,
  or,
  type SQL,
  sql,
} from "drizzle-orm"

import type { Role } from "@/lib/auth/roles"
import type { Sort } from "@/lib/schemas/api/list"
import type { DbOrTx } from "@/server/db/client"
import { containsPattern, escapeLike } from "@/server/db/like"
import {
  accounts,
  sessions,
  twoFactors,
  users,
  verifications,
} from "@/server/db/schema"

// Any constant: serialises owner-count checks (demote/ban the last owner).
const OWNERS_LOCK_ID = 7_314_002

const hasPassword = exists(
  sql`(select 1 from ${accounts} where ${accounts.userId} = ${users.id} and ${accounts.providerId} = 'credential')`
)

/** Banned now (a ban whose end date passed no longer counts). */
const bannedNow = and(
  eq(users.banned, true),
  or(isNull(users.banExpires), gt(users.banExpires, sql`now()`))
) as SQL

const hasRole = (role: Role) =>
  sql`${role} = any(string_to_array(${users.role}, ','))`

const userColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  title: users.title,
  role: users.role,
  banned: users.banned,
  banReason: users.banReason,
  banExpires: users.banExpires,
  twoFactorEnabled: users.twoFactorEnabled,
  createdAt: users.createdAt,
  hasPassword: sql<boolean>`${hasPassword}`,
}

export type UserRow = {
  id: string
  name: string
  email: string
  title: string | null
  role: string | null
  banned: boolean | null
  banReason: string | null
  banExpires: Date | null
  twoFactorEnabled: boolean | null
  createdAt: Date
  hasPassword: boolean
}

export async function findUserById(
  db: DbOrTx,
  id: string
): Promise<UserRow | null> {
  const [row] = await db.select(userColumns).from(users).where(eq(users.id, id))
  return row ?? null
}

export async function findUserByEmail(
  db: DbOrTx,
  email: string
): Promise<UserRow | null> {
  const [row] = await db
    .select(userColumns)
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
  return row ?? null
}

export type UserFilters = {
  role?: Role
  status?: "active" | "invited" | "banned"
  q?: string
}

function whereFor(filters: UserFilters): SQL | undefined {
  const conditions: (SQL | undefined)[] = []
  if (filters.role) conditions.push(hasRole(filters.role))
  if (filters.status === "banned") conditions.push(bannedNow)
  if (filters.status === "active")
    conditions.push(and(not(bannedNow), hasPassword))
  if (filters.status === "invited")
    conditions.push(and(not(bannedNow), not(hasPassword)))
  if (filters.q) {
    const pattern = containsPattern(filters.q)
    conditions.push(
      or(
        ilike(users.name, pattern),
        ilike(users.email, pattern),
        ilike(users.title, pattern)
      )
    )
  }
  return and(...conditions)
}

export async function listUsers(
  db: DbOrTx,
  opts: {
    filters: UserFilters
    sort: Sort<"createdAt" | "name" | "email">
    page: number
    pageSize: number
  }
) {
  const where = whereFor(opts.filters)
  const [{ total }] = await db
    .select({ total: count() })
    .from(users)
    .where(where)
  const column = {
    createdAt: users.createdAt,
    name: users.name,
    email: users.email,
  }[opts.sort.field]
  const rows = await db
    .select(userColumns)
    .from(users)
    .where(where)
    .orderBy(
      opts.sort.dir === "asc" ? asc(column) : desc(column),
      asc(users.id)
    )
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize)
  return { rows: rows as UserRow[], total }
}

export async function updateUserProfile(
  db: DbOrTx,
  id: string,
  values: { name?: string; title?: string | null }
): Promise<void> {
  await db.update(users).set(values).where(eq(users.id, id))
}

export async function setUserRoles(
  db: DbOrTx,
  id: string,
  roles: Role[]
): Promise<void> {
  await db
    .update(users)
    .set({ role: roles.join(",") })
    .where(eq(users.id, id))
}

export async function setUserBan(
  db: DbOrTx,
  id: string,
  ban: { reason: string | null; expiresAt: Date | null } | null
): Promise<void> {
  await db
    .update(users)
    .set(
      ban
        ? { banned: true, banReason: ban.reason, banExpires: ban.expiresAt }
        : { banned: false, banReason: null, banExpires: null }
    )
    .where(eq(users.id, id))
}

/**
 * Signs `userId` out everywhere: their own sessions and every impersonation
 * session they started (impersonation never outlives the impersonator).
 */
export async function deleteUserSessions(
  db: DbOrTx,
  userId: string
): Promise<number> {
  const deleted = await db
    .delete(sessions)
    .where(or(eq(sessions.userId, userId), eq(sessions.impersonatedBy, userId)))
    .returning({ id: sessions.id })
  return deleted.length
}

export async function listUserSessions(db: DbOrTx, userId: string) {
  return db
    .select({
      id: sessions.id,
      ipAddress: sessions.ipAddress,
      userAgent: sessions.userAgent,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
      impersonatedBy: sessions.impersonatedBy,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, sql`now()`)))
    .orderBy(desc(sessions.createdAt))
}

/** Transaction-scoped lock taken before any owner-count check. */
export async function lockOwners(tx: DbOrTx): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(${OWNERS_LOCK_ID})`)
}

/**
 * Active owners (have a password, not banned now), excluding `exceptUserId`.
 * An invited owner who never chose a password does not count.
 */
export async function countActiveOwners(
  db: DbOrTx,
  exceptUserId: string
): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(users)
    .where(
      and(
        hasRole("owner"),
        not(bannedNow),
        hasPassword,
        ne(users.id, exceptUserId)
      )
    )
  return n
}

/**
 * Deletes every unused password link (invite, reset, recovery) of `userId`:
 * Better Auth's `reset-password:<token>` verification rows whose value is the
 * user id. Returns how many were deleted.
 */
export async function deletePasswordTokens(
  db: DbOrTx,
  userId: string
): Promise<number> {
  const deleted = await db
    .delete(verifications)
    .where(
      and(
        like(verifications.identifier, "reset-password:%"),
        eq(verifications.value, userId)
      )
    )
    .returning({ id: verifications.id })
  return deleted.length
}

/** Deletes the sessions in which someone is impersonating `userId`. */
export async function deleteImpersonationSessionsOf(
  db: DbOrTx,
  userId: string
): Promise<number> {
  const deleted = await db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), isNotNull(sessions.impersonatedBy)))
    .returning({ id: sessions.id })
  return deleted.length
}

/** Turns two-factor off and deletes the TOTP secret and backup codes. */
export async function clearTwoFactor(
  db: DbOrTx,
  userId: string
): Promise<void> {
  await db.delete(twoFactors).where(eq(twoFactors.userId, userId))
  await db
    .update(users)
    .set({ twoFactorEnabled: false })
    .where(eq(users.id, userId))
}

/**
 * The same verification row Better Auth's /request-password-reset writes
 * (`reset-password:<token>` → user id), inside the caller's transaction.
 */
export async function insertPasswordToken(
  db: DbOrTx,
  row: { userId: string; token: string; expiresAt: Date }
): Promise<void> {
  await db.insert(verifications).values({
    identifier: `reset-password:${row.token}`,
    value: row.userId,
    expiresAt: row.expiresAt,
  })
}

export async function deleteUserById(db: DbOrTx, id: string): Promise<void> {
  await db.delete(users).where(eq(users.id, id))
}

/** Users whose email ends in "@<domain>" (demo accounts). */
export async function listUsersByEmailDomain(
  db: DbOrTx,
  domain: string
): Promise<UserRow[]> {
  const rows = await db
    .select(userColumns)
    .from(users)
    .where(like(users.email, `%@${escapeLike(domain)}`))
    .orderBy(asc(users.email))
  return rows as UserRow[]
}

/** Deletes users (sessions, accounts, 2FA cascade; authored rows keep a null actor). */
export async function deleteUsersByIds(
  db: DbOrTx,
  ids: string[]
): Promise<number> {
  if (ids.length === 0) return 0
  const deleted = await db
    .delete(users)
    .where(inArray(users.id, ids))
    .returning({ id: users.id })
  return deleted.length
}
