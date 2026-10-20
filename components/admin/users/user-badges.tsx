import { ShieldCheck, ShieldOff } from "lucide-react"

import { StatusPill } from "@/components/admin/kit/status-pill"
import { Badge } from "@/components/ui/badge"
import { ROLE_INFO, STATUS_INFO, type UserStatus } from "@/lib/admin/user-roles"
import { ROLES, type Role } from "@/lib/auth/roles"

/** Active / Invited / Banned as a kit pill. */
export function UserStatusPill({ status }: { status: UserStatus }) {
  const info = STATUS_INFO[status]
  return <StatusPill tone={info.tone}>{info.label}</StatusPill>
}

/** 2FA on/off with text (never colour or icon alone). */
export function TwoFactorIndicator({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <span className="text-success inline-flex items-center gap-1 text-sm">
      <ShieldCheck aria-hidden className="size-4" />
      2FA on
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      <ShieldOff aria-hidden className="size-4" />
      2FA off
    </span>
  )
}

/** One badge per role, in matrix order. */
export function RoleBadges({ roles }: { roles: readonly Role[] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {ROLES.filter((role) => roles.includes(role)).map((role) => (
        <Badge key={role} variant="secondary">
          {ROLE_INFO[role].label}
        </Badge>
      ))}
    </span>
  )
}
