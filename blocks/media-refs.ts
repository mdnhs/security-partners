import { z } from "zod"

import { collectMediaIds as collectFrom } from "@/lib/media"

const mediaId = z.uuid()

/**
 * Every media id a builder document references (hero images, card icons,
 * rich-text images…): the media_usages rows a save keeps in step.
 *
 * Drafts are loose (`data` is any record), so ids that are not uuids are
 * skipped here; DraftDocument itself refuses them on their field, so parse
 * (or validate) a draft before relying on this list.
 */
export function collectMediaIds(doc: {
  blocks: { data: unknown }[]
}): string[] {
  const ids = new Set<string>()
  for (const block of doc.blocks) collectFrom(block.data, ids)
  return [...ids].filter((id) => mediaId.safeParse(id).success)
}
