"use client"

import { useQueryClient } from "@tanstack/react-query"
import { ChevronsUpDown, CircleUserRound, LogOut } from "lucide-react"
import Link from "next/link"

import { useSignOut } from "@/components/admin/auth/sign-out-button"
import { useAdminSession } from "@/components/admin/session-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

/** "Edith Editor" → "EE"; one name → its first letter. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters =
    parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts.slice(0, 1)
  return letters.map((part) => part[0]!.toUpperCase()).join("")
}

/** Signed-in user (sidebar footer): account link and sign out. */
export function NavUser() {
  const { user, roles } = useAdminSession()
  const queryClient = useQueryClient()
  const { isMobile, setOpenMobile } = useSidebar()
  // The next user must never see this user's cached data.
  const { signOut, pending, error, clearError } = useSignOut(() =>
    queryClient.clear()
  )
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu
          onOpenChange={(open) => {
            if (open) clearError()
          }}
        >
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
              />
            }
          >
            <Avatar className="size-8 rounded-lg after:rounded-lg">
              <AvatarFallback
                aria-hidden
                className="rounded-lg bg-sidebar-primary font-bold text-sidebar-primary-foreground"
              >
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <span className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-sidebar-foreground/70">
                {user.email}
              </span>
            </span>
            <ChevronsUpDown aria-hidden className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col gap-0.5 px-1.5 py-1.5 font-normal">
                <span className="truncate text-sm font-medium text-foreground">
                  {user.name}
                </span>
                <span className="truncate text-xs">{user.email}</span>
                <span className="truncate text-xs capitalize">
                  {roles.join(", ")}
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={<Link href="/admin/account" />}
              onClick={() => setOpenMobile(false)}
            >
              <CircleUserRound aria-hidden />
              Account
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={pending} onClick={signOut}>
              <LogOut aria-hidden />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Outside the menu (which closes on click); cleared on reopen. */}
        {error ? (
          <p
            role="alert"
            className="px-2 pt-1 text-xs font-medium text-red-300 group-data-[collapsible=icon]:sr-only"
          >
            {error}
          </p>
        ) : null}
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
