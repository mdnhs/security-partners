"use client"

import { useTheme } from "next-themes"
import { useEffect, useSyncExternalStore } from "react"

import { ADMIN_THEME_STORAGE_KEY } from "@/components/admin/theme-provider"
import type { AdminThemeConfig } from "@/lib/theme/schema"

/** The mode this component last applied (so a later own choice is told apart). */
export const ADMIN_THEME_AUTO_KEY = "sp-admin-theme-auto"

type Mode = AdminThemeConfig["mode"]
const MODES: readonly string[] = ["system", "light", "dark"] satisfies Mode[]

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage unavailable (private mode, blocked site data): nothing to remember.
  }
}

/**
 * The same decision as the effect below, as an inline script: in the
 * server HTML it runs while the streamed boundary is parsed, before that
 * content is revealed, so it never paints in the wrong mode. It does what
 * next-themes (attribute "class", enableSystem) does for a stored theme.
 */
export function modeScript(mode: Mode): string {
  const args = [mode, ADMIN_THEME_STORAGE_KEY, ADMIN_THEME_AUTO_KEY]
    .map((v) => JSON.stringify(v))
    .join(",")
  return (
    "(function(m,k,a){try{var l=localStorage,s=l.getItem(k);" +
    "if(s!==null&&s!==l.getItem(a))return;l.setItem(k,m);l.setItem(a,m);" +
    'var t=m==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):m,' +
    'e=document.documentElement;e.classList.remove("light","dark");' +
    `e.classList.add(t);e.style.colorScheme=t}catch(_){}})(${args})`
  )
}

const subscribe = () => () => {}

/**
 * Applies the published admin mode (Appearance) as the default. A theme the
 * user picked themselves (stored value ≠ the one applied here) always wins.
 * Server render and hydration emit the pre-paint script; a client-side
 * mount (navigation) renders nothing, since React never runs such scripts,
 * and the effect alone syncs next-themes.
 */
export function DefaultMode({ mode }: { mode: Mode }) {
  const { setTheme } = useTheme()
  const clientMount = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
  useEffect(() => {
    if (!MODES.includes(mode)) return
    const stored = read(ADMIN_THEME_STORAGE_KEY)
    if (stored !== null && stored !== read(ADMIN_THEME_AUTO_KEY)) return
    setTheme(mode)
    write(ADMIN_THEME_AUTO_KEY, mode)
  }, [mode, setTheme])
  if (clientMount || !MODES.includes(mode)) return null
  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: modeScript(mode) }}
    />
  )
}
