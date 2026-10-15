"use client"

import type { QueryClient } from "@tanstack/react-query"
import type { ReactNode } from "react"

import { AdminProviders } from "@/components/admin/providers"
import {
  type AdminSession,
  AdminSessionProvider,
} from "@/components/admin/session-provider"

import { ImpersonationBanner } from "./impersonation-banner"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"

/** Signed-in admin frame: sidebar (≥ 1024 px), topbar, main landmark. */
export function AdminShell({
  session,
  children,
  queryClient,
}: {
  session: AdminSession
  children: ReactNode
  queryClient?: QueryClient
}) {
  return (
    <AdminSessionProvider value={session}>
      <AdminProviders client={queryClient}>
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:ring-3 focus:ring-ring/50"
        >
          Skip to content
        </a>
        {session.impersonatedBy ? (
          <ImpersonationBanner name={session.user.name} />
        ) : null}
        <div className="flex min-h-svh">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main
              id="main"
              tabIndex={-1}
              className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8"
            >
              {children}
            </main>
          </div>
        </div>
      </AdminProviders>
    </AdminSessionProvider>
  )
}
