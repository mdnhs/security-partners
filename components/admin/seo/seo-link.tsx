"use client"

import { SearchCheck } from "lucide-react"
import Link from "next/link"

import { EDITOR_ACTION } from "@/components/admin/editor/editor-layout"
import { buttonVariants } from "@/components/ui/button"
import { usePermission } from "@/hooks/use-permission"
import type { SeoKind } from "@/lib/schemas/api/seo"
import { cn } from "@/lib/utils"

/** Editor header link to this record's SEO sheet (SEO › Overview). */
export function SeoLink({ kind, id }: { kind: SeoKind; id: string }) {
  const canRead = usePermission({ seo: ["read"] })
  if (!canRead) return null
  return (
    <Link
      href={`/admin/seo?edit=${encodeURIComponent(`${kind}:${id}`)}`}
      className={cn(buttonVariants({ variant: "outline" }), EDITOR_ACTION)}
    >
      <SearchCheck aria-hidden />
      SEO
    </Link>
  )
}
