"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { type ReactNode, useEffect, useRef, useState } from "react"

import {
  type TabChangeOptions,
  useTabParam,
} from "@/components/admin/section-tabs/section-tabs"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

/** ?tab= value of an editor's SEO tab (Fix links: `<editor>?tab=seo`). */
export const SEO_TAB = "seo"

export type EditorTabState = {
  /** The SEO tab is selected. */
  active: boolean
  /** The SEO tab was shown once: it stays mounted from then on. */
  seoMounted: boolean
  select: (tab: "content" | "seo", options?: TabChangeOptions) => void
}

/**
 * Content / SEO selection in ?tab= (shared with the form's section tabs:
 * any value but "seo" is the Content tab, on that section). Back to
 * Content restores the section that was open.
 */
export function useEditorTab(enabled: boolean): EditorTabState {
  const [param, selectParam] = useTabParam()
  const active = enabled && param === SEO_TAB
  const lastSection = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (param !== SEO_TAB) lastSection.current = param
  })
  const [seoMounted, setSeoMounted] = useState(active)
  if (active && !seoMounted) setSeoMounted(true)
  return {
    active,
    seoMounted,
    select: (tab, options) =>
      selectParam(
        tab === "seo" ? SEO_TAB : (lastSection.current ?? null),
        options
      ),
  }
}

/** Top Content / SEO tabs of an editor; both panels stay mounted. */
export function EditorTabs({
  state,
  content,
  seo,
}: {
  state: EditorTabState
  content: ReactNode
  seo: ReactNode
}) {
  return (
    <Tabs
      value={state.active ? "seo" : "content"}
      onValueChange={(value) =>
        state.select(value === "seo" ? "seo" : "content")
      }
      className="gap-6"
    >
      <TabsList aria-label="Editor" className="pointer-coarse:h-12">
        <TabsTrigger value="content" className="px-5">
          Content
        </TabsTrigger>
        <TabsTrigger value="seo" className="px-5">
          SEO
        </TabsTrigger>
      </TabsList>
      <TabsPrimitive.Panel value="content" keepMounted className="min-w-0">
        {content}
      </TabsPrimitive.Panel>
      <TabsPrimitive.Panel value="seo" keepMounted className="min-w-0">
        {state.seoMounted ? seo : null}
      </TabsPrimitive.Panel>
    </Tabs>
  )
}
