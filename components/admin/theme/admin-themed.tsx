import { Suspense } from "react"

import { AdminThemeStyle } from "./admin-theme-style"

/**
 * The published admin theme and the content it styles in one Suspense
 * boundary: the content (or a nested fallback, like the panel skeleton)
 * can never paint before the token overrides and the default mode.
 */
export function AdminThemed({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AdminThemeStyle />
      {children}
    </Suspense>
  )
}
