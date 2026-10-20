import { z } from "zod"

import type { VersionedDto } from "./content"
import type {
  EditableSettingsKey,
  SettingsGroup,
} from "@/lib/admin/settings-keys"

/** `/settings/:key` — any string; the service answers 404 for keys not edited here. */
export const settingsKeyParam = z.object({ key: z.string().min(1).max(64) })

export type SettingsDto = VersionedDto<unknown> & {
  key: EditableSettingsKey
  label: string
  description: string
  group: SettingsGroup
  canEdit: boolean
}

export type SettingsListItem = Omit<SettingsDto, "draft" | "published">
