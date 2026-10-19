"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { toast } from "sonner"

import { api, unwrap } from "@/lib/api-client"
import type { SeoEntry, SeoKind, SeoOverviewDto } from "@/lib/schemas/api/seo"
import type { Seo } from "@/lib/schemas/common"

import { SEO_OVERVIEW_KEY } from "./keys"

/**
 * Saves one record's SEO (live, last write wins; no version bump) and puts
 * the saved entry into the overview cache. Throws the ApiError on failure
 * (SeoPanel shows its field errors).
 */
export function useSaveSeo(kind: SeoKind, id: string) {
  const queryClient = useQueryClient()
  return useCallback(
    async (seo: Seo): Promise<SeoEntry> => {
      const saved = await unwrap(
        api.seo.entries[":kind"][":id"].$put({
          param: { kind, id },
          json: { seo },
        })
      )
      queryClient.setQueryData<SeoOverviewDto>(SEO_OVERVIEW_KEY, (old) =>
        old
          ? {
              ...old,
              entries: old.entries.map((e) =>
                e.kind === saved.kind && e.id === saved.id ? saved : e
              ),
            }
          : old
      )
      // The overview and the health (title-unique depends on other records).
      void queryClient.invalidateQueries({ queryKey: ["seo"] })
      toast.success("SEO saved", { description: "The live page uses it now." })
      return saved
    },
    [queryClient, kind, id]
  )
}
