import { z } from "zod"

import { iconCard, mediaRef, richText } from "@/lib/schemas/common"

export { iconCard, mediaRef, richText }

/**
 * Required copy with the length the section design can carry. Like
 * lib/schemas/common `text`, never trimmed: copy renders byte-identical.
 */
export const text = (max: number) =>
  z.string().min(1, "Required").max(max, `At most ${max} characters`)

/** A count of items a collection-backed block shows. */
export const count = (max: number) => z.number().int().min(1).max(max)

/** Blocks that render a shared section exactly as Settings › Sections has it. */
export const sharedOnly = z.object({ useShared: z.literal(true) })

/** Eyebrow, heading and intro above a section's cards. */
export const sectionCopy = {
  eyebrow: text(40),
  heading: text(80),
  intro: text(240),
}
