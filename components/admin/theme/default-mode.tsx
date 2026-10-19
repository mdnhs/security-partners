"use client"

import { useTheme } from "next-themes"
import { useEffect } from "react"

import { ADMIN_THEME_STORAGE_KEY } from "@/components/admin/theme-provider"
import type { AdminThemeConfig } from "@/lib/theme/schema"

/** The mode this component last applied (so a later own choice is told apart). */
export const ADMIN_THEME_AUTO_KEY = "sp-admin-theme-auto"

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
 * Applies the published admin mode (Appearance) as the default. A theme the
 * user picked themselves (stored value ≠ the one applied here) always wins.
 */
export function DefaultMode({ mode }: { mode: AdminThemeConfig["mode"] }) {
  const { setTheme } = useTheme()
  useEffect(() => {
    const stored = read(ADMIN_THEME_STORAGE_KEY)
    if (stored !== null && stored !== read(ADMIN_THEME_AUTO_KEY)) return
    setTheme(mode)
    write(ADMIN_THEME_AUTO_KEY, mode)
  }, [mode, setTheme])
  return null
}
