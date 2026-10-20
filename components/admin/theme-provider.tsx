"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ComponentProps } from "react"

/** The admin's own key: a theme chosen here never touches the public site. */
export const ADMIN_THEME_STORAGE_KEY = "sp-admin-theme"

/**
 * Light, dark or system for the admin. Deliberately no single-key hotkey
 * (WCAG 2.1.4): the theme changes from the user menu or the Account page.
 */
export function AdminThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey={ADMIN_THEME_STORAGE_KEY}
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
