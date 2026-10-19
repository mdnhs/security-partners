"use client"

import { SearchCheck } from "lucide-react"

import { EDITOR_ACTION } from "@/components/admin/editor/editor-layout"
import { SEO_TAB } from "@/components/admin/editor/editor-tabs"
import { useTabParam } from "@/components/admin/section-tabs/section-tabs"
import { buttonVariants } from "@/components/ui/button"
import { usePermission } from "@/hooks/use-permission"
import { cn } from "@/lib/utils"

/** Editor header link to this record's SEO tab (?tab=seo on the same page). */
export function SeoLink() {
  const canRead = usePermission({ seo: ["read"] })
  const [, select] = useTabParam()
  if (!canRead) return null
  return (
    <a
      href={`?tab=${SEO_TAB}`}
      className={cn(buttonVariants({ variant: "outline" }), EDITOR_ACTION)}
      onClick={(event) => {
        // A plain click switches the tab in place (unsaved edits stay);
        // new-tab clicks keep the link's default.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button)
          return
        event.preventDefault()
        select(SEO_TAB)
      }}
    >
      <SearchCheck aria-hidden />
      SEO
    </a>
  )
}
