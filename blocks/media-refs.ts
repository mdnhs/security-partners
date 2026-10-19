import { collectMediaIds as collectFrom } from "@/lib/media"

/**
 * Every media id a builder document references (hero images, card icons,
 * rich-text images…): the media_usages rows a save keeps in step.
 */
export function collectMediaIds(doc: {
  blocks: { data: unknown }[]
}): string[] {
  const ids = new Set<string>()
  for (const block of doc.blocks) collectFrom(block.data, ids)
  return [...ids]
}
