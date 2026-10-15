"use client"

import { useQueryClient } from "@tanstack/react-query"
import { ExternalLink } from "lucide-react"

import { SignOutButton } from "@/components/admin/auth/sign-out-button"
import { useAdminSession } from "@/components/admin/session-provider"
import { buttonClassName } from "@/components/ui/button"

import { MobileNav } from "./mobile-nav"

/** Page-level header: navigation trigger (mobile), site link, user, sign out. */
export function Topbar({ search }: { search?: React.ReactNode }) {
  const { user, roles } = useAdminSession()
  const queryClient = useQueryClient()
  return (
    <header className="flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:px-4 lg:px-6">
      <MobileNav />
      <div className="min-w-0 flex-1">{search}</div>
      <a
        href="/"
        target="_blank"
        rel="noreferrer"
        className={buttonClassName({ variant: "ghost", size: "sm" })}
      >
        <ExternalLink aria-hidden />
        <span className="max-sm:sr-only">View site</span>
        {/* Whitespace-only text is dropped by the flex layout. */}{" "}
        <span className="sr-only">(opens in new tab)</span>
      </a>
      <div className="hidden min-w-0 flex-col items-end leading-tight md:flex">
        <span className="max-w-48 truncate text-sm font-medium">
          {user.name}
        </span>
        <span className="text-xs text-muted-foreground capitalize">
          {roles.join(", ")}
        </span>
      </div>
      {/* The next user must never see this user's cached data. */}
      <SignOutButton onSignedOut={() => queryClient.clear()} />
    </header>
  )
}
