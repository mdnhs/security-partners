import { Suspense } from "react"

import { SiteThemeStyle } from "@/components/site-theme-style"

/**
 * A public page's request-time content and the published brand overrides
 * in one Suspense boundary: the content never paints before the theme.
 *
 * Per page, not around the layout's {children}: a layout-level boundary
 * turns the catch-all's notFound() into a streamed soft 404 (HTTP 200),
 * which also breaks proxy.ts' 404 rewrites for unknown slugs.
 */
export function SiteThemed({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <SiteThemeStyle />
      {children}
    </Suspense>
  )
}
