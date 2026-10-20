import { hasPermission } from "@/lib/auth/permissions"
import { ROLES, type Role } from "@/lib/auth/roles"
import type { USER_STATUSES } from "@/lib/schemas/api/users"

export type UserStatus = (typeof USER_STATUSES)[number]

/** Names and one-line summaries of the spec §6.1 roles (admin UI copy). */
export const ROLE_INFO: Record<Role, { label: string; description: string }> = {
  owner: {
    label: "Owner",
    description: "Everything, including other owners and custom code.",
  },
  admin: {
    label: "Admin",
    description: "Everything except custom code and owner accounts.",
  },
  editor: {
    label: "Editor",
    description:
      "Pages, services, articles, collections, media, SEO and content settings.",
  },
  author: {
    label: "Author",
    description: "Writes articles and submits them for review.",
  },
  marketer: {
    label: "Marketer",
    description: "SEO, redirects, consent and tracking.",
  },
  intake: {
    label: "Intake",
    description: "Reads and follows up enquiries (leads).",
  },
  viewer: {
    label: "Viewer",
    description: "Read-only access to content and settings.",
  },
}

/** Status pill copy and kit tone (components/admin/kit/status-pill). */
export const STATUS_INFO: Record<
  UserStatus,
  { label: string; tone: "success" | "info" | "danger" }
> = {
  active: { label: "Active", tone: "success" },
  invited: { label: "Invited", tone: "info" },
  banned: { label: "Banned", tone: "danger" },
}

/** Owner accounts and the `owner` role are owner-only (users service rule). */
export function managesOwners(actorRoles: readonly string[]): boolean {
  return hasPermission(actorRoles, { owner: ["manage"] })
}

/** Roles the actor may grant: everything, minus `owner` for non-owners. */
export function assignableRoles(actorRoles: readonly string[]): Role[] {
  return managesOwners(actorRoles)
    ? [...ROLES]
    : ROLES.filter((role) => role !== "owner")
}

/** False when the target is an owner and the actor is not (server answers 403). */
export function mayManageUser(
  actorRoles: readonly string[],
  targetRoles: readonly string[]
): boolean {
  return !targetRoles.includes("owner") || managesOwners(actorRoles)
}

/** "Owner, Editor" in ROLES order. */
export function roleLabels(roles: readonly Role[]): string {
  return ROLES.filter((role) => roles.includes(role))
    .map((role) => ROLE_INFO[role].label)
    .join(", ")
}
