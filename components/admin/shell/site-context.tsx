"use client"

import { createContext, type ReactNode, useContext } from "react"

import { DEFAULT_SITE, type SiteInfo } from "./constants"

const SiteContext = createContext<SiteInfo>(DEFAULT_SITE)

/** The public site this admin edits (configured origin + environment). */
export function SiteInfoProvider({
  value,
  children,
}: {
  value: SiteInfo
  children: ReactNode
}) {
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

export const useSiteInfo = () => useContext(SiteContext)
