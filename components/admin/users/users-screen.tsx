"use client"

import Link from "next/link"

import {
  columnsFor,
  DataTable,
  type DataTableColumns,
} from "@/components/admin/data-table/data-table"
import { useUrlFilters } from "@/components/admin/data-table/list-url"
import { FilterSelect } from "@/components/admin/filter-field"
import { RelativeTime } from "@/components/admin/kit/relative-time"
import { PageHeader } from "@/components/admin/page-header"
import { usePermission } from "@/hooks/use-permission"
import { ROLE_INFO, roleLabels, STATUS_INFO } from "@/lib/admin/user-roles"
import { api, unwrap } from "@/lib/api-client"
import { ROLES, type Role } from "@/lib/auth/roles"
import { USER_STATUSES } from "@/lib/schemas/api/users"

import { InviteUserDialog } from "./invite-dialog"
import type { UserItem } from "./types"
import { RoleBadges, TwoFactorIndicator, UserStatusPill } from "./user-badges"

type Row = UserItem & Record<string, unknown>
type Status = (typeof USER_STATUSES)[number]
const ch = columnsFor<Row>()

// Column definitions live at module scope (TanStack Table v9 needs stable references).
const columns = ch.columns([
  ch.accessor("name", {
    header: "Name",
    cell: (info) => (
      <span className="flex flex-col">
        <Link
          href={`/admin/users/${info.row.original.id}`}
          className="font-semibold underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {info.getValue()}
        </Link>
        {info.row.original.title ? (
          <span className="text-xs text-muted-foreground">
            {info.row.original.title}
          </span>
        ) : null}
      </span>
    ),
  }),
  ch.accessor("email", {
    header: "Email",
    cell: (info) => (
      <span className="text-muted-foreground">{info.getValue()}</span>
    ),
  }),
  ch.display({
    id: "roles",
    header: "Roles",
    cell: ({ row }) => <RoleBadges roles={row.original.roles} />,
  }),
  ch.display({
    id: "status",
    header: "Status",
    cell: ({ row }) => <UserStatusPill status={row.original.status} />,
  }),
  ch.display({
    id: "twoFactor",
    header: "Two-factor",
    cell: ({ row }) => (
      <TwoFactorIndicator enabled={row.original.twoFactorEnabled} />
    ),
  }),
  ch.accessor("createdAt", {
    header: "Added",
    cell: (info) => (
      <span className="text-muted-foreground">
        <RelativeTime iso={info.getValue()} />
      </span>
    ),
  }),
]) as unknown as DataTableColumns<Row>

/** Users list (spec §8.1): search, role/status filters, invite. */
export function UsersScreen() {
  const canInvite = usePermission({ user: ["invite"] })
  // Kept in ?role=&status= so returning from a user restores the list.
  const [params, setParams] = useUrlFilters(["role", "status"] as const)
  const role = (ROLES as readonly string[]).includes(params.role)
    ? (params.role as Role)
    : ""
  const status = (USER_STATUSES as readonly string[]).includes(params.status)
    ? (params.status as Status)
    : ""
  const filters = { role: role || undefined, status: status || undefined }
  const filterKey = role || status ? `${role}|${status}` : ""
  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone who can sign in to the admin. Invite people, change their roles, or block access."
        actions={canInvite ? <InviteUserDialog /> : null}
      />
      <DataTable<Row>
        syncUrl
        label="Users"
        queryKey={["users", filters]}
        filterKey={filterKey}
        filteredEmpty="Nobody matches these filters"
        initialSort={[{ id: "createdAt", desc: true }]}
        searchPlaceholder="Search name or email"
        toolbar={
          <>
            <FilterSelect
              id="users-role"
              label="Role"
              value={role}
              onChange={(value) => setParams({ role: value })}
              options={[
                { value: "", label: "All roles" },
                ...ROLES.map((r) => ({ value: r, label: ROLE_INFO[r].label })),
              ]}
            />
            <FilterSelect
              id="users-status"
              label="Status"
              value={status}
              onChange={(value) => setParams({ status: value })}
              options={[
                { value: "", label: "All statuses" },
                ...USER_STATUSES.map((s) => ({
                  value: s,
                  label: STATUS_INFO[s].label,
                })),
              ]}
            />
          </>
        }
        fetchPage={async (params) =>
          (await unwrap(
            api.users.$get({
              query: {
                page: String(params.page),
                pageSize: String(params.pageSize),
                sort: params.sort,
                q: params.q,
                ...filters,
              },
            })
          )) as { items: Row[]; page: number; pageSize: number; total: number }
        }
        columns={columns}
        renderCard={(user) => (
          <div className="rounded-card relative flex flex-col gap-2 bg-card p-4">
            <span className="flex items-center justify-between gap-2">
              <Link
                href={`/admin/users/${user.id}`}
                className="after:rounded-card truncate font-semibold outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
              >
                {user.name}
              </Link>
              <UserStatusPill status={user.status} />
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {user.email}
            </span>
            <span className="flex items-center justify-between gap-2 text-xs">
              <span>{roleLabels(user.roles)}</span>
              <TwoFactorIndicator enabled={user.twoFactorEnabled} />
            </span>
          </div>
        )}
        empty="No users yet"
        emptyDescription="People you invite appear here with their roles and status."
        emptyAction={canInvite ? <InviteUserDialog /> : null}
      />
    </>
  )
}
