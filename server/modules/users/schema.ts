import "server-only"

import { parseRoles } from "@/lib/auth/permissions"
import type { Role } from "@/lib/auth/roles"

import type { UserRow } from "./repo"

export type UserStatus = "active" | "invited" | "banned"

/** API shape of a user (dates ISO 8601 UTC). */
export type UserItem = {
  id: string
  name: string
  email: string
  title: string | null
  roles: Role[]
  status: UserStatus
  banReason: string | null
  banExpires: string | null
  twoFactorEnabled: boolean
  createdAt: string
}

export type UserSessionItem = {
  id: string
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  expiresAt: string
  impersonatedBy: string | null
}

export type InviteResult = {
  user: UserItem
  /** Always returned so an admin can copy it when email is not configured. */
  inviteUrl: string
  emailDelivered: boolean
}

export type PasswordLinkResult = { url: string; emailDelivered: boolean }

export function isBannedNow(row: Pick<UserRow, "banned" | "banExpires">) {
  return (
    !!row.banned && !(row.banExpires && row.banExpires.getTime() <= Date.now())
  )
}

export function toUserItem(row: UserRow): UserItem {
  const banned = isBannedNow(row)
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    title: row.title,
    roles: parseRoles(row.role),
    status: banned ? "banned" : row.hasPassword ? "active" : "invited",
    banReason: banned ? row.banReason : null,
    banExpires: banned && row.banExpires ? row.banExpires.toISOString() : null,
    twoFactorEnabled: !!row.twoFactorEnabled,
    createdAt: row.createdAt.toISOString(),
  }
}
