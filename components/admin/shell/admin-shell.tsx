"use client"

import type { QueryClient } from "@tanstack/react-query"
import type { CSSProperties, ReactNode } from "react"

import { AdminProviders } from "@/components/admin/providers"
import {
  type AdminSession,
  AdminSessionProvider,
} from "@/components/admin/session-provider"
import { SidebarProvider } from "@/components/ui/sidebar"

import { AppSidebar } from "./app-sidebar"
import { CommandPalette } from "./command-palette"
import { DEFAULT_SITE, type SiteInfo } from "./constants"
import { ImpersonationBanner } from "./impersonation-banner"
import type { NavBadges } from "./nav"
import { CommandPaletteProvider } from "./palette-context"
import { Topbar } from "./topbar"

/**
 * Signed-in admin frame (JW floating panels): a 288 px sidebar panel, the
 * 72 px topbar panel and the content panel on a white canvas with 16 px
 * gutters. The content panel scrolls inside its own corners; --content-h is
 * its visible height for sticky panes inside (svh − gutters − topbar − gap).
 */
export function AdminShell({
  session,
  children,
  queryClient,
  defaultSidebarOpen = true,
  site = DEFAULT_SITE,
  badges,
}: {
  session: AdminSession
  children: ReactNode
  queryClient?: QueryClient
  /** Desktop sidebar expanded (the `sidebar_state` cookie remembers it). */
  defaultSidebarOpen?: boolean
  /** The public site (website card). */
  site?: SiteInfo
  /** Counts beside nav items (e.g. new leads, from Phase 7). */
  badges?: NavBadges
}) {
  return (
    <AdminSessionProvider value={session}>
      <AdminProviders
        cacheKey={`${session.user.id}:${session.impersonatedBy ?? ""}`}
        client={queryClient}
      >
        <CommandPaletteProvider>
          <a
            href="#main"
            className="sr-only z-50 rounded-xl bg-card px-4 py-2 text-sm font-semibold shadow-lg focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:ring-3 focus:ring-ring/50"
          >
            Skip to content
          </a>
          <SidebarProvider
            defaultOpen={defaultSidebarOpen}
            style={{ "--sidebar-width": "20rem" } as CSSProperties}
          >
            <AppSidebar site={site} badges={badges} />
            <div className="flex h-svh min-w-0 flex-1 flex-col gap-4 p-3 [--content-h:calc(100svh-112px)] sm:p-4 sm:[--content-h:calc(100svh-120px)] lg:pl-0">
              {/* One header wrapper: the impersonation banner stacks above
                  the topbar instead of covering it; the sidebar sits beside
                  the column, never underneath (WCAG 2.2 SC 2.4.11). */}
              <div
                data-slot="admin-header"
                className="flex shrink-0 flex-col gap-3"
              >
                {session.impersonatedBy ? (
                  <ImpersonationBanner name={session.user.name} />
                ) : null}
                <Topbar />
              </div>
              <main
                id="main"
                tabIndex={-1}
                className="rounded-card relative min-h-0 flex-1 overflow-y-auto overscroll-contain bg-sidebar p-4 outline-none sm:p-6 lg:p-8"
              >
                {children}
              </main>
            </div>
          </SidebarProvider>
          <CommandPalette />
        </CommandPaletteProvider>
      </AdminProviders>
    </AdminSessionProvider>
  )
}
