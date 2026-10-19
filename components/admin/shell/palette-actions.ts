import type { PermissionRequest } from "@/lib/auth/permissions"

/**
 * ⌘K's client-side actions (MK parity §13). Destinations come from the nav
 * registry and records from the search API; these are what is left.
 */
export type PaletteAction = {
  id: string
  label: string
  keywords: readonly string[]
  run(): void
}

/**
 * Case-insensitive: every word of `q` must appear in the label or in one of
 * the keywords. An empty query matches everything.
 */
export function matchesQuery(
  q: string,
  label: string,
  keywords: readonly string[] = []
): boolean {
  const haystack = [label, ...keywords].map((text) => text.toLowerCase())
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.some((text) => text.includes(word)))
}

type ActionInput = {
  setTheme(t: "light" | "dark" | "system"): void
  /** Must ask first while something is unsaved (the shell's sign-out does). */
  signOut(): void
  /** A new tab (the live site). */
  open(href: string): void
  can(p: PermissionRequest): boolean
  /** In-app navigation through the unsaved-changes guard. */
  navigate(href: string): void
}

/** The actions, in MK order; a create action is left out without its permission. */
export function buildActions({
  setTheme,
  signOut,
  open,
  can,
  navigate,
}: ActionInput): PaletteAction[] {
  const gated: (PaletteAction & { permission?: PermissionRequest })[] = [
    {
      id: "new-article",
      label: "New article",
      keywords: ["create", "write", "post", "blog", "insight"],
      permission: { article: ["create"] },
      run: () => navigate("/admin/insights/new"),
    },
    {
      id: "new-service",
      label: "New service",
      keywords: ["create", "add", "offering"],
      permission: { service: ["create"] },
      run: () => navigate("/admin/services/new"),
    },
    {
      id: "open-site",
      label: "Open the live site",
      keywords: ["website", "view", "public", "preview"],
      run: () => open("/"),
    },
    {
      id: "theme-light",
      label: "Switch to light theme",
      keywords: ["appearance", "mode", "day"],
      run: () => setTheme("light"),
    },
    {
      id: "theme-dark",
      label: "Switch to dark theme",
      keywords: ["appearance", "mode", "night"],
      run: () => setTheme("dark"),
    },
    {
      id: "theme-system",
      label: "Use the system theme",
      keywords: ["appearance", "mode", "auto"],
      run: () => setTheme("system"),
    },
    {
      id: "sign-out",
      label: "Sign out",
      keywords: ["log out", "logout", "exit"],
      run: signOut,
    },
  ]
  return gated
    .filter((action) => !action.permission || can(action.permission))
    .map(({ permission: _permission, ...action }) => action)
}
