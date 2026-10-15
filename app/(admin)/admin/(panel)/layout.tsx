import Link from "next/link"
import { Suspense } from "react"

import { SignOutButton } from "@/components/admin/auth/sign-out-button"
import { requireSession } from "@/server/auth/session"

/**
 * Minimal signed-in frame until the Phase 4 shell replaces it (sidebar, ⌘K,
 * impersonation banner). The session is read fresh inside Suspense.
 */
export default function PanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={null}>
      <PanelFrame>{children}</PanelFrame>
    </Suspense>
  )
}

async function PanelFrame({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession()
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-4">
          <Link href="/admin" className="font-bold text-brand-navy">
            Security Partners
          </Link>
          <nav aria-label="Admin" className="flex items-center gap-4 text-sm">
            <Link
              href="/admin"
              className="text-muted-foreground hover:text-foreground"
            >
              Dashboard
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user.name}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  )
}
