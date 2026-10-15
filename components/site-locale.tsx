"use client"

import { useEffect } from "react"

/**
 * Applies settings.site.locale to <html lang>. The root layout is part of
 * the static shell (built without a database), so it ships lang="en" and
 * this corrects it after hydration when the setting differs. Renders nothing.
 */
export function SiteLocale({ lang }: { lang: string }) {
  useEffect(() => {
    if (document.documentElement.lang !== lang)
      document.documentElement.lang = lang
  }, [lang])
  return null
}
