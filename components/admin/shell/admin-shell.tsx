"use client"

import type { QueryClient } from "@tanstack/react-query"
import { type CSSProperties, type ReactNode, useEffect, useRef } from "react"

import { AdminProviders } from "@/components/admin/providers"
import {
  type AdminSession,
  AdminSessionProvider,
} from "@/components/admin/session-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

import { AppSidebar } from "./app-sidebar"
import { DEFAULT_SITE, type SiteInfo } from "./constants"
import type { NavBadges } from "./nav"
import { ImpersonationBanner } from "./impersonation-banner"
import { SiteHeader } from "./site-header"

/**
 * Signed-in admin frame (shadcn dashboard-01): inset sidebar (a sheet below
 * 1024 px), sticky header, main landmark.
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
  /** The public site (website card and View site links). */
  site?: SiteInfo
  /** Counts beside nav items (e.g. new leads, from Phase 7). */
  badges?: NavBadges
}) {
  const headerRef = useStickyHeaderHeight()
  return (
    <AdminSessionProvider value={session}>
      <AdminProviders
        cacheKey={`${session.user.id}:${session.impersonatedBy ?? ""}`}
        client={queryClient}
      >
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:ring-3 focus:ring-ring/50"
        >
          Skip to content
        </a>
        <SidebarProvider
          defaultOpen={defaultSidebarOpen}
          style={
            {
              "--sidebar-width": "calc(var(--spacing) * 64)",
              "--header-height": "calc(var(--spacing) * 14)",
            } as CSSProperties
          }
        >
          <AppSidebar site={site} badges={badges} />
          <SidebarInset className="min-w-0">
            {/*
             * One sticky header for the content column: the impersonation
             * banner stacks above the site header instead of covering it, and
             * the sidebar sits beside it, never underneath (WCAG 2.2 SC 2.4.11).
             */}
            <div
              ref={headerRef}
              data-slot="admin-header"
              className="sticky top-0 z-30 lg:overflow-hidden lg:rounded-t-xl"
            >
              {session.impersonatedBy ? (
                <ImpersonationBanner name={session.user.name} />
              ) : null}
              <SiteHeader siteUrl={site.url} />
            </div>
            <main
              id="main"
              tabIndex={-1}
              className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8"
            >
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </AdminProviders>
    </AdminSessionProvider>
  )
}

/**
 * Publishes the sticky header's height (banner included) as
 * --admin-header-h on <html>: admin.css turns it into scroll-padding-top,
 * so focused or scrolled-to content is never hidden under it (WCAG 2.4.11).
 */
function useStickyHeaderHeight() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const header = ref.current
    if (!header || typeof ResizeObserver === "undefined") return
    const root = document.documentElement
    const observer = new ResizeObserver(() => {
      root.style.setProperty("--admin-header-h", `${header.offsetHeight}px`)
    })
    observer.observe(header)
    return () => {
      observer.disconnect()
      root.style.removeProperty("--admin-header-h")
    }
  }, [])
  return ref
}
