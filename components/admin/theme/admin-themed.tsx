import { Suspense } from "react"

import { AdminThemeStyle } from "./admin-theme-style"

/**
 * The published admin theme and the content it styles in one Suspense
 * boundary: the content (or a nested fallback, like the panel skeleton)
 * can never paint before the token overrides and the default mode.
 *
 * The theme read is dynamic, so the content streams into a hidden segment
 * that only React's inline script reveals. `noscript` puts the same content
 * in the static shell's fallback inside <noscript>: without JavaScript the
 * page still shows (default tokens) and its native form POSTs still work;
 * with JavaScript the browser ignores it, so nothing paints early. Only for
 * cheap, static content (the auth pages): it renders the children twice.
 */
export function AdminThemed({
  children,
  noscript = false,
}: {
  children: React.ReactNode
  noscript?: boolean
}) {
  return (
    <Suspense fallback={noscript ? <noscript>{children}</noscript> : null}>
      <AdminThemeStyle />
      {children}
    </Suspense>
  )
}
