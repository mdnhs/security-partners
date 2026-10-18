import { z } from "zod"

import type { GrowthSettingsKey } from "@/lib/admin/growth-settings"

import type { VersionedDto } from "./content"

/** `/marketing/:key` — the service answers 404 for keys not edited here. */
export const growthKeyParam = z.object({ key: z.string().min(1).max(64) })

export type GrowthSettingsDto = VersionedDto<unknown> & {
  key: GrowthSettingsKey
  label: string
  description: string
  canEdit: boolean
}
