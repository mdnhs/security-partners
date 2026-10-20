// No hooks or handlers: renders on the server too.
import { CheckIcon, MinusIcon } from "lucide-react"

import { StatusPill } from "@/components/admin/kit/status-pill"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ROLE_INFO } from "@/lib/admin/user-roles"
import {
  actionLabel,
  type MatrixCell,
  type MatrixRow,
  permissionMatrix,
  resourceLabel,
} from "@/lib/auth/matrix"
import type { Resource } from "@/lib/auth/permissions"
import { ROLES } from "@/lib/auth/roles"

function Cell({ value }: { value: MatrixCell }) {
  if (value === "own") return <StatusPill tone="info">Own only</StatusPill>
  if (value === "yes")
    return (
      <>
        <CheckIcon aria-hidden className="text-success mx-auto size-4" />
        <span className="sr-only">Allowed</span>
      </>
    )
  return (
    <>
      <MinusIcon aria-hidden className="mx-auto size-4 text-muted-foreground" />
      <span className="sr-only">Not allowed</span>
    </>
  )
}

/**
 * Narrowings the server applies on top of the grants above, so an "Allowed"
 * cell is never read as more than it is (users service, settings service,
 * AI service, auth impersonation rules).
 */
const RUNTIME_LIMITS = [
  "Admins’ user actions (edit, block, view as, sign out everywhere) never apply to owner accounts; only owners manage owners.",
  "Editors’ settings changes cover content settings only.",
  "The AI assistant is also limited to the roles chosen in Integrations, and is read-only while viewing as someone else.",
  "Nobody can view as someone else while already viewing as someone else.",
  "Anyone who can upload media may edit the alt text and focal point of their own uploads (also the caption and decorative flag), even without media update.",
  "New articles from a role that cannot edit every article are always under that person’s own byline.",
] as const

/** Rows grouped by resource, in statement order. */
function groups(rows: MatrixRow[]): [Resource, MatrixRow[]][] {
  const out = new Map<Resource, MatrixRow[]>()
  for (const row of rows) {
    const list = out.get(row.resource) ?? []
    list.push(row)
    out.set(row.resource, list)
  }
  return [...out]
}

/**
 * Users & roles → Roles: what each role may do. Read-only documentation
 * generated from lib/auth/permissions; roles are changed per person.
 */
export function PermissionMatrix() {
  return (
    <div className="flex flex-col gap-6">
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {ROLES.map((role) => (
          <div key={role} className="flex flex-col gap-0.5">
            <dt className="text-sm font-semibold">{ROLE_INFO[role].label}</dt>
            <dd className="text-sm text-muted-foreground">
              {ROLE_INFO[role].description}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">
        Generated from the access rules; it cannot be edited here. Change what
        someone can do by changing their roles on the People tab. “Own only”
        means their own drafts.
      </p>
      <div className="rounded-card border bg-card">
        <Table scrollLabel="Permissions by role">
          <TableCaption className="sr-only">
            Users & roles: permissions
          </TableCaption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead
                scope="col"
                className="sticky left-0 z-10 bg-card text-muted-foreground"
              >
                Permission
              </TableHead>
              {ROLES.map((role) => (
                <TableHead key={role} scope="col" className="text-center">
                  {ROLE_INFO[role].label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          {groups(permissionMatrix()).map(([resource, rows]) => (
            <TableBody
              key={resource}
              data-resource={resource}
              className="border-b last:border-0"
            >
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead
                  scope="rowgroup"
                  colSpan={ROLES.length + 1}
                  className="h-10 text-xs font-semibold tracking-wide uppercase"
                >
                  {/* Sticky label: stays in view while the table scrolls sideways. */}
                  <span className="sticky left-4 inline-block">
                    {resourceLabel(resource)}
                  </span>
                </TableHead>
              </TableRow>
              {rows.map((row) => (
                <TableRow key={row.action} data-action={row.action}>
                  <TableHead
                    scope="row"
                    className="sticky left-0 z-10 h-auto bg-card py-3 font-normal"
                  >
                    {actionLabel(row.action)}
                  </TableHead>
                  {ROLES.map((role) => (
                    <TableCell key={role} className="text-center">
                      <Cell value={row.cells[role]} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          ))}
        </Table>
      </div>
      <section aria-labelledby="matrix-limits" className="flex flex-col gap-2">
        <h2 id="matrix-limits" className="text-sm font-semibold">
          Limits applied at runtime
        </h2>
        <ul
          aria-labelledby="matrix-limits"
          className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground"
        >
          {RUNTIME_LIMITS.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
