"use client"

import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { DashboardCard } from "@/components/admin/kit/dashboard-card"
import type { SeoHealthDto } from "@/lib/schemas/api/seo"

/** Where the media library lists images without alt text (D1.1 filter). */
export const MISSING_ALT_HREF = "/admin/media?missingAlt=true"

/**
 * SEO › Overview: alt-text coverage of the whole image library
 * ("X of Y images described · Z decorative").
 */
export function AltTextCard({ alt }: { alt: SeoHealthDto["alt"] }) {
  // Covered = described or decorative (decorative images need no alt).
  const share = alt.images === 0 ? 1 : (alt.images - alt.missing) / alt.images
  return (
    <DashboardCard title="Alt text">
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          <span className="font-semibold">
            {alt.described} of {alt.images} images described
          </span>
          <span className="text-muted-foreground">
            {" · "}
            {alt.decorative} decorative
          </span>
        </p>
        <div aria-hidden className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            data-slot="alt-coverage"
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.round(share * 100)}%` }}
          />
        </div>
        {alt.missing > 0 ? (
          <p className="text-sm text-muted-foreground">
            {alt.missing === 1
              ? "1 image has no alt text."
              : `${alt.missing} images have no alt text.`}
          </p>
        ) : null}
        <Link
          href={MISSING_ALT_HREF}
          className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none pointer-coarse:h-11"
        >
          Find images without alt text
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    </DashboardCard>
  )
}
