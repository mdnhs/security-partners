import { hasPermission, statements, type Resource } from "./permissions"
import { ROLES, type Role } from "./roles"

/**
 * Read-only documentation of the role grants, generated from
 * `lib/auth/permissions` (the single source of truth): nothing here grants
 * or edits anything. New resources/actions appear automatically.
 */
export type MatrixCell = "yes" | "no" | "own"
export type MatrixRow = {
  resource: Resource
  action: string
  cells: Record<Role, MatrixCell>
}

/** Every action named in `statements` (labels must cover each one). */
export type Action = (typeof statements)[Resource][number]

/**
 * Actions that are own-only unless the role also holds the "any" action
 * (server/modules/articles/policy.ts): authors edit, delete and submit only
 * their own unpublished drafts (`maySubmit` needs `updateAny` for others').
 */
const OWN_SCOPE: Partial<Record<Resource, Record<string, string>>> = {
  article: { update: "updateAny", delete: "deleteAny", submit: "updateAny" },
}

const ownScopeOf = (resource: Resource, action: string): string | undefined => {
  const scope = OWN_SCOPE[resource]
  return scope && Object.hasOwn(scope, action) ? scope[action] : undefined
}

/**
 * One row per `statements` action, in statement order. A role holding an
 * OWN_SCOPE action without its "any" action gets "own".
 */
export function permissionMatrix(): MatrixRow[] {
  const rows: MatrixRow[] = []
  for (const resource of Object.keys(statements) as Resource[]) {
    for (const action of statements[resource] as readonly string[]) {
      const any = ownScopeOf(resource, action)
      const cells = Object.fromEntries(
        ROLES.map((role): [Role, MatrixCell] => {
          const can = (a: string) =>
            hasPermission([role], { [resource]: [a] } as never)
          if (!can(action)) return [role, "no"]
          return [role, any && !can(any) ? "own" : "yes"]
        })
      ) as Record<Role, MatrixCell>
      rows.push({ resource, action, cells })
    }
  }
  return rows
}

// Both maps are exhaustive at compile time: a resource or action added on
// another branch fails `tsc` until it gets its label here.
export const RESOURCE_LABELS: Record<Resource, string> = {
  page: "Pages",
  service: "Services",
  article: "Articles",
  collection: "Collections",
  media: "Media",
  lead: "Enquiries",
  seo: "SEO",
  redirect: "Redirects",
  marketing: "Consent & tracking",
  customCode: "Custom code",
  settings: "Settings",
  integration: "Integrations",
  user: "Users",
  owner: "Owner accounts",
  audit: "Audit log",
  ai: "AI assistant",
  appearance: "Appearance",
  newsletter: "Newsletter",
}

export const ACTION_LABELS: Record<Action, string> = {
  read: "View",
  create: "Create",
  update: "Edit",
  publish: "Publish",
  delete: "Delete",
  submit: "Submit for review",
  updateAny: "Edit anyone's",
  deleteAny: "Delete anyone's",
  export: "Export",
  test: "Test connection",
  invite: "Invite",
  ban: "Block",
  impersonate: "View as",
  revokeSessions: "Sign out everywhere",
  manage: "Manage",
  use: "Use",
}

export const resourceLabel = (resource: Resource): string =>
  RESOURCE_LABELS[resource]

/** `MatrixRow.action` is a plain string: an unknown key shows as itself (defensive). */
export const actionLabel = (action: string): string =>
  Object.hasOwn(ACTION_LABELS, action)
    ? ACTION_LABELS[action as Action]
    : action
