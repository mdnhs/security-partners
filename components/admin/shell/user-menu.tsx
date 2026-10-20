"use client"

import {
  LogOut,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"

import { initials } from "@/components/admin/kit/format"
import { useAdminSession } from "@/components/admin/session-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ROLE_INFO } from "@/lib/admin/user-roles"
import { ROLES } from "@/lib/auth/roles"

import { useShellSignOut } from "./sign-out-context"

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const

/**
 * The avatar in the topbar; from lg the trigger also shows name, email and
 * the primary role (MK). The menu repeats them with every role (Account,
 * Security, Theme, Sign out). A failed sign-out shows below the trigger and
 * clears when the menu reopens (a dock failure stays).
 */
export function UserMenu() {
  const { user, roles } = useAdminSession()
  const { theme, setTheme } = useTheme()
  const { signOut, pending, error, clearError } = useShellSignOut()
  const menuError = error?.source === "menu" ? error.message : null
  // The highest role in ROLES order (owner first).
  const primaryRole = ROLES.find((role) => roles.includes(role))
  return (
    <div className="relative">
      <DropdownMenu
        onOpenChange={(open) => {
          // Only the menu's own failure clears; the dock keeps its error.
          if (open && error?.source === "menu") clearError()
        }}
      >
        <DropdownMenuTrigger
          aria-label={`Account menu for ${user.name}`}
          className="flex shrink-0 items-center gap-3 rounded-full p-1 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 lg:pr-4"
        >
          <Avatar aria-hidden className="size-11">
            <AvatarFallback className="bg-primary font-semibold text-primary-foreground">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          {/* At lg (1024 px: a 688 px topbar beside the 20rem sidebar) the
              identity caps at 144 px so search, AI, mail, bell, avatar and
              the role chip still fit; xl gives it 224 px. Name and email
              truncate inside. */}
          <span
            data-slot="user-identity"
            className="hidden max-w-36 min-w-0 flex-col lg:flex xl:max-w-56"
          >
            <span className="truncate text-sm font-semibold text-foreground">
              {user.name}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          </span>
          {primaryRole ? (
            // MK: a grey chip of its own at the far right of the identity.
            <span
              data-slot="role-pill"
              className="hidden shrink-0 items-center rounded-full bg-muted px-2.5 py-1 text-xs leading-none font-medium text-foreground lg:inline-flex"
            >
              {ROLE_INFO[primaryRole].label}
            </span>
          ) : null}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col">
              <span className="truncate font-semibold text-foreground">
                {user.name}
              </span>
              <span className="truncate text-xs font-normal">{user.email}</span>
              {roles.length ? (
                <Badge variant="secondary" className="mt-2 w-fit capitalize">
                  {roles.join(", ")}
                </Badge>
              ) : null}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem render={<Link href="/admin/account" />}>
              <UserRound aria-hidden />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<Link href="/admin/account?tab=security" />}
            >
              <ShieldCheck aria-hidden />
              Security
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={theme ?? "system"}
              onValueChange={(value) => setTheme(String(value))}
            >
              {THEMES.map(({ value, label, icon: Icon }) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  <Icon aria-hidden />
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={pending} onClick={() => signOut("menu")}>
            <LogOut aria-hidden />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {menuError ? (
        <p
          role="alert"
          className="bg-danger-soft text-danger absolute top-full right-0 z-40 mt-2 w-64 rounded-xl px-3 py-2 text-xs font-medium shadow-lg"
        >
          {menuError}
        </p>
      ) : null}
    </div>
  )
}
