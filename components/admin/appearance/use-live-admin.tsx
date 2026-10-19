"use client"

import { useTheme } from "next-themes"
import { useEffect } from "react"

import { liveDeclarations } from "@/lib/theme/css"
import type { AdminThemeConfig } from "@/lib/theme/schema"

const CUSTOM_PROPERTY = /^--[a-z][a-z0-9-]*$/

// Sets each declaration inline on `root`; the returned cleanup removes only
// those, so anything else inline survives.
export function applyLive(
  root: HTMLElement,
  decls: [string, string][]
): () => void {
  const set: string[] = []
  for (const [name, value] of decls) {
    if (!CUSTOM_PROPERTY.test(name)) continue
    root.style.setProperty(name, value)
    set.push(name)
  }
  return () => {
    for (const name of set) root.style.removeProperty(name)
  }
}

// While mounted with a config, the draft is the admin itself: inline on
// <html>, which beats the published <style id="theme-tokens">. Unmounting or
// passing null hands back to the published theme.
// The admin's mode as drawn now (next-themes, honouring a forced theme);
// `resolved` stays undefined until next-themes has read the stored choice.
export function useAdminMode(): {
  mode: "light" | "dark"
  resolved: string | undefined
} {
  const { resolvedTheme, forcedTheme } = useTheme()
  const resolved = forcedTheme ?? resolvedTheme
  return { mode: resolved === "dark" ? "dark" : "light", resolved }
}

export function useLiveAdmin(admin: AdminThemeConfig | null): void {
  const { mode, resolved } = useAdminMode()
  useEffect(() => {
    // Wait for next-themes to resolve, so a dark user never sees light tokens.
    if (!admin || resolved === undefined) return
    return applyLive(document.documentElement, liveDeclarations(admin, mode))
  }, [admin, mode, resolved])
}
