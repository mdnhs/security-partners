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

import { useShellSignOut } from "./sign-out-context"

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const

/**
 * The avatar alone in the topbar; name, email and roles sit in the menu
 * (Account, Security, Theme, Sign out). A failed sign-out shows below the
 * avatar and clears when the menu reopens.
 */
export function UserMenu() {
  const { user, roles } = useAdminSession()
  const { theme, setTheme } = useTheme()
  const { signOut, pending, error, clearError } = useShellSignOut()
  const menuError = error?.source === "menu" ? error.message : null
  return (
    <div className="relative">
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) clearError()
        }}
      >
        <DropdownMenuTrigger
          aria-label={`Account menu for ${user.name}`}
          className="flex shrink-0 rounded-full p-1 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Avatar aria-hidden className="size-11">
            <AvatarFallback className="bg-primary font-semibold text-primary-foreground">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
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
