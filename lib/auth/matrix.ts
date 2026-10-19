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

/**
 * One row per `statements` action, in statement order. An action that has an
 * `…Any` sibling (article `update` → `updateAny`) is "own" for a role that
 * holds it without the sibling: own drafts only (articles service).
 */
export function permissionMatrix(): MatrixRow[] {
  const rows: MatrixRow[] = []
  for (const resource of Object.keys(statements) as Resource[]) {
    const actions = statements[resource] as readonly string[]
    for (const action of actions) {
      const any = `${action}Any`
      const scoped = actions.includes(any)
      const cells = Object.fromEntries(
        ROLES.map((role): [Role, MatrixCell] => {
          const can = (a: string) =>
            hasPermission([role], { [resource]: [a] } as never)
          if (!can(action)) return [role, "no"]
          return [role, scoped && !can(any) ? "own" : "yes"]
        })
      ) as Record<Role, MatrixCell>
      rows.push({ resource, action, cells })
    }
  }
  return rows
}

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
}

export const ACTION_LABELS: Record<string, string> = {
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

/** "someThing" → "Some thing": a resource/action added elsewhere without a label. */
const humanize = (key: string) => {
  const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const labelFrom = (labels: Record<string, string>, key: string) =>
  Object.hasOwn(labels, key) ? labels[key] : humanize(key)

export const resourceLabel = (resource: string): string =>
  labelFrom(RESOURCE_LABELS, resource)

export const actionLabel = (action: string): string =>
  labelFrom(ACTION_LABELS, action)
