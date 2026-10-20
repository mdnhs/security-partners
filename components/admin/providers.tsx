"use client"

import {
  environmentManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import type { ReactNode } from "react"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ApiError } from "@/lib/api-client"

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // 4xx answers are final (permissions, validation, not found).
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status < 500) &&
          failureCount < 2,
      },
    },
  })
}

/** Toasts' top edge: AdminShell's measured header bottom + 8 px. */
export const TOAST_TOP = "var(--admin-toast-top, 96px)"

let browserQueryClient: { key: string; client: QueryClient } | undefined

/**
 * The browser's QueryClient for one identity (`cacheKey`, e.g.
 * "<userId>:<impersonatorId>"). A new identity gets a fresh client, so cached
 * data never leaks from one user (or impersonation) to the next.
 */
export function getQueryClient(cacheKey: string): QueryClient {
  if (environmentManager.isServer()) return makeQueryClient()
  if (browserQueryClient?.key !== cacheKey)
    browserQueryClient = { key: cacheKey, client: makeQueryClient() }
  return browserQueryClient.client
}

/** TanStack Query, tooltips and toasts for the signed-in admin. */
export function AdminProviders({
  children,
  cacheKey,
  client,
}: {
  children: ReactNode
  /** Identity the query cache belongs to (see getQueryClient). */
  cacheKey: string
  /** Tests pass their own client. */
  client?: QueryClient
}) {
  // No useState: React drops state if it suspends before the first render.
  const queryClient = client ?? getQueryClient(cacheKey)
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
        {/*
         * Top centre (MK), 8 px below the header (topbar, plus the
         * impersonation banner when shown): AdminShell publishes its bottom
         * as --admin-toast-top, so toasts never cover the topbar's controls.
         * The fallback is the plain header (16 px gutter + 72 px + 8 px).
         * A sheet's close button ends at 56 px, so it stays reachable; bottom
         * bars (sticky editor bar, sheet footers, AI composer) are never
         * covered.
         */}
        <Toaster
          position="top-center"
          offset={{ top: TOAST_TOP }}
          mobileOffset={{ top: TOAST_TOP }}
          richColors
          closeButton
        />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
