import { z } from "zod"

import { ROLES } from "@/lib/auth/roles"

import { listQuery, sortParam } from "./list"

export const roleSchema = z.enum(ROLES)

/** One or more roles, duplicates removed (order kept). */
export const rolesSchema = z
  .array(roleSchema)
  .min(1, "Choose at least one role")
  .transform((roles) => [...new Set(roles)])

const name = z.string().trim().min(1, "Required").max(100)
/** Byline title; blank → null (no title). */
const title = z
  .string()
  .trim()
  .max(100)
  .transform((v) => v || null)

export const inviteUserInput = z.object({
  email: z
    .email("Enter a valid email address")
    .max(254)
    .transform((v) => v.toLowerCase()),
  name,
  title: title.optional(),
  roles: rolesSchema,
})

export const updateUserInput = z
  .object({ name: name.optional(), title: title.nullable().optional() })
  .refine((v) => v.name !== undefined || v.title !== undefined, {
    message: "Nothing to update",
  })

/**
 * The same rules for a user's own profile via Better Auth's /update-user
 * (final review M1; enforced by a before hook in server/auth/hooks.ts).
 */
export const selfProfileInput = z.object({
  name: name.optional(),
  title: title.nullable().optional(),
})

export const setRolesInput = z.object({ roles: rolesSchema })

export const banUserInput = z.object({
  reason: z.string().trim().max(200).optional(),
  /** Omit for a ban without end date. */
  expiresInDays: z.number().int().min(1).max(3650).optional(),
})

export const USER_STATUSES = ["active", "invited", "banned"] as const

export const userListQuery = listQuery.extend({
  sort: sortParam(["createdAt", "name", "email"], {
    field: "createdAt",
    dir: "desc",
  }),
  role: roleSchema.optional(),
  status: z.enum(USER_STATUSES).optional(),
})

export type InviteUserInput = z.output<typeof inviteUserInput>
export type UpdateUserInput = z.output<typeof updateUserInput>
export type SetRolesInput = z.output<typeof setRolesInput>
export type BanUserInput = z.output<typeof banUserInput>
export type UserListQuery = z.output<typeof userListQuery>
