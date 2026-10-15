"use client"

import { ExternalLink } from "lucide-react"

import { SignOutButton } from "@/components/admin/auth/sign-out-button"
import { useAdminSession } from "@/components/admin/session-provider"
import { buttonClassName } from "@/components/ui/button"

import { MobileNav } from "./mobile-nav"

/** Page-level header: navigation trigger (mobile), site link, user, sign out. */
export function Topbar({ search }: { search?: React.ReactNode }) {
  const { user, roles } = useAdminSession()
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:px-4 lg:px-6">
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
      </a>
      <div className="hidden min-w-0 flex-col items-end leading-tight md:flex">
        <span className="max-w-48 truncate text-sm font-medium">
          {user.name}
        </span>
        <span className="text-xs text-muted-foreground capitalize">
          {roles.join(", ")}
        </span>
      </div>
      <SignOutButton />
    </header>
  )
}
