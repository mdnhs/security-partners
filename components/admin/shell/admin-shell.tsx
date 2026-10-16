"use client"

import type { QueryClient } from "@tanstack/react-query"
import { usePathname } from "next/navigation"
import { type CSSProperties, type ReactNode, useEffect, useRef } from "react"

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
import { ShellSignOutProvider } from "./sign-out-context"
import { SiteInfoProvider } from "./site-context"
import { Topbar } from "./topbar"

/**
 * Signed-in admin frame (JW floating panels): a 288 px sidebar panel, the
 * 72 px topbar panel and the content panel on a white canvas with 16 px
 * gutters. The content panel scrolls inside its own corners; --content-h is
 * its visible height for sticky panes inside (svh − gutters − topbar − gap).
 * --content-h does not subtract the impersonation banner (its height wraps
 * with the viewport): while impersonating, the panel is shorter by the
 * banner plus a 12 px gap, so panes sized by it must also cap at the panel
 * (e.g. max-h-full) rather than rely on it alone. Inside the panel,
 * --main-h is its measured height (banner included) and --main-pad its
 * padding, so sticky panes can size and offset themselves exactly.
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
  const mainRef = useMainPanel()
  return (
    <AdminSessionProvider value={session}>
      <AdminProviders
        cacheKey={`${session.user.id}:${session.impersonatedBy ?? ""}`}
        client={queryClient}
      >
        <ShellSignOutProvider>
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
                  ref={mainRef}
                  id="main"
                  tabIndex={-1}
                  className="rounded-card relative min-h-0 flex-1 overflow-y-auto overscroll-contain bg-sidebar p-(--main-pad) outline-none [--main-pad:1rem] sm:[--main-pad:1.5rem] lg:[--main-pad:2rem]"
                >
                  <SiteInfoProvider value={site}>{children}</SiteInfoProvider>
                </main>
              </div>
            </SidebarProvider>
            <CommandPalette />
          </CommandPaletteProvider>
        </ShellSignOutProvider>
      </AdminProviders>
    </AdminSessionProvider>
  )
}

/**
 * The content panel, not the document, scrolls, so Next's scroll-to-top on
 * navigation never reaches it: a new page starts at the panel's top. A URL
 * with a #fragment is left alone so the browser scrolls the target into view.
 * Also publishes the panel's height as --main-h.
 */
function useMainPanel() {
  const ref = useRef<HTMLElement>(null)
  const pathname = usePathname()
  useEffect(() => {
    if (ref.current && !window.location.hash) ref.current.scrollTop = 0
  }, [pathname])
  // --main-h: the panel's height (it shrinks under the impersonation banner).
  useEffect(() => {
    const main = ref.current
    if (!main) return
    const measure = () =>
      main.style.setProperty("--main-h", `${main.clientHeight}px`)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(main)
    return () => observer.disconnect()
  }, [])
  return ref
}
