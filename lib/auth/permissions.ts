import { createAccessControl } from "better-auth/plugins/access"

import { ROLES, type Role } from "./roles"

/** Every resource and action the platform authorises (spec §6.1). Isomorphic: safe in client code. */
export const statements = {
  page: ["read", "update", "publish"],
  service: ["read", "create", "update", "publish", "delete"],
  article: [
    "read",
    "create",
    "update",
    "publish",
    "delete",
    "submit",
    "updateAny",
    "deleteAny",
  ],
  collection: ["read", "create", "update", "delete"], // team, clients, group companies, categories
  media: ["read", "create", "update", "delete"],
  lead: ["read", "update", "delete", "export"],
  seo: ["read", "update"],
  redirect: ["read", "create", "update", "delete"],
  marketing: ["read", "update"], // consent + tracking
  customCode: ["read", "update"],
  settings: ["read", "update"], // content globals
  integration: ["read", "update", "test"],
  user: ["read", "invite", "update", "ban", "impersonate", "revokeSessions"],
  owner: ["manage"],
  audit: ["read"],
  ai: ["use"],
  newsletter: ["read", "export", "delete"],
} as const

export type Resource = keyof typeof statements
export type PermissionRequest = {
  [R in Resource]?: (typeof statements)[R][number][]
}
type Grants = { [R in Resource]?: readonly (typeof statements)[R][number][] }

export const ac = createAccessControl(statements)

const all = <R extends Resource>(resource: R) => statements[resource]

const EVERYTHING = {
  page: all("page"),
  service: all("service"),
  article: all("article"),
  collection: all("collection"),
  media: all("media"),
  lead: all("lead"),
  seo: all("seo"),
  redirect: all("redirect"),
  marketing: all("marketing"),
  customCode: all("customCode"),
  settings: all("settings"),
  integration: all("integration"),
  user: all("user"),
  owner: all("owner"),
  audit: all("audit"),
  ai: all("ai"),
  newsletter: all("newsletter"),
} satisfies Required<Grants>

/**
 * Spec §6.1 role matrix. `article:update/delete` without `updateAny/deleteAny`
 * means "own drafts only" (enforced by the articles service, Phase 5).
 * `settings:update` for editors is limited to content keys by the settings
 * service (Phase 4). `ai:use` is narrowed at runtime by
 * `integrations.ai.allowedRoles` (Phase 9).
 */
export const ROLE_GRANTS: Record<Role, Grants> = {
  owner: EVERYTHING,
  admin: {
    page: all("page"),
    service: all("service"),
    article: all("article"),
    collection: all("collection"),
    media: all("media"),
    lead: all("lead"),
    seo: all("seo"),
    redirect: all("redirect"),
    marketing: all("marketing"),
    settings: all("settings"),
    integration: all("integration"),
    user: all("user"),
    audit: all("audit"),
    ai: all("ai"),
    newsletter: all("newsletter"),
  },
  editor: {
    page: all("page"),
    service: all("service"),
    article: all("article"),
    collection: all("collection"),
    media: all("media"),
    seo: all("seo"),
    settings: ["read", "update"],
    ai: ["use"],
  },
  author: {
    article: ["read", "create", "update", "delete", "submit"],
    media: ["read", "create"],
    ai: ["use"],
  },
  marketer: {
    seo: all("seo"),
    redirect: all("redirect"),
    marketing: all("marketing"),
    page: ["read"],
    service: ["read"],
    article: ["read"],
    media: ["read", "create"],
    ai: ["use"],
    newsletter: ["read", "export"],
  },
  intake: {
    lead: ["read", "update", "export"],
    ai: ["use"],
  },
  viewer: {
    page: ["read"],
    service: ["read"],
    article: ["read"],
    collection: ["read"],
    media: ["read"],
    seo: ["read"],
    redirect: ["read"],
    marketing: ["read"],
    settings: ["read"],
  },
}

/** Better Auth access-control roles built from ROLE_GRANTS. */
export const roles = Object.fromEntries(
  ROLES.map((role) => [role, ac.newRole(ROLE_GRANTS[role])])
) as Record<Role, ReturnType<typeof ac.newRole>>

const isRole = (value: string): value is Role =>
  (ROLES as readonly string[]).includes(value)

/**
 * True when every requested action is granted by at least one of the roles
 * (union across roles). Unknown roles grant nothing; an empty request is denied.
 */
export function hasPermission(
  userRoles: readonly string[],
  req: PermissionRequest
): boolean {
  const entries = Object.entries(req) as [Resource, readonly string[]][]
  if (entries.length === 0) return false
  const known = userRoles.filter(isRole)
  // Fail closed on malformed requests: only own keys of `statements`
  // (never "__proto__"/"toString") and real, non-empty action arrays.
  return entries.every(
    ([resource, actions]) =>
      Object.hasOwn(statements, resource) &&
      Array.isArray(actions) &&
      actions.length > 0 &&
      actions.every((action) =>
        known.some(
          (role) =>
            roles[role].authorize({ [resource]: [action] } as never).success
        )
      )
  )
}

/** Better Auth stores roles comma-joined in users.role. Unknown names are dropped. */
export function parseRoles(value: string | null | undefined): Role[] {
  if (!value) return []
  const out: Role[] = []
  for (const raw of value.split(",")) {
    const role = raw.trim()
    if (isRole(role) && !out.includes(role)) out.push(role)
  }
  return out
}
