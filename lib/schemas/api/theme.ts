import { z } from "zod"

import type { ContrastIssue } from "@/lib/theme/checks"
import { PRESET_IDS } from "@/lib/theme/presets"
import { ThemeConfig, type ThemeConfigValue } from "@/lib/theme/schema"

import { versionInput } from "./content"

/** GET/PUT/POST /api/v1/admin/appearance — the theme settings row. */
export type ThemeDto = {
  draft: ThemeConfigValue
  published: ThemeConfigValue | null
  version: number
  updatedAt: string
  /** checkTheme(draft): publish is refused while this is non-empty. */
  issues: ContrastIssue[]
  /** The draft differs from what is live. */
  hasDraft: boolean
}

/** PUT /draft. Colours are parsed and rebuilt as oklch() (no raw CSS stored). */
export const themeDraftInput = versionInput.extend({ draft: ThemeConfig })
export type ThemeDraftInput = z.input<typeof themeDraftInput>

export const THEME_RESET_SCOPES = ["site", "admin", "both"] as const
export type ThemeResetScope = (typeof THEME_RESET_SCOPES)[number]

/** POST /reset: the scope's draft becomes the preset's defaults. */
export const themeResetInput = versionInput.extend({
  preset: z.enum(PRESET_IDS),
  scope: z.enum(THEME_RESET_SCOPES),
})
export type ThemeResetInput = z.infer<typeof themeResetInput>

/** POST /publish, POST /discard. */
export const themeVersionInput = versionInput
export type ThemeVersionInput = z.infer<typeof themeVersionInput>

/** POST /restore: a revision (GET /revisions/settings/theme) into the draft. */
export const themeRestoreInput = versionInput.extend({ revisionId: z.uuid() })
export type ThemeRestoreInput = z.infer<typeof themeRestoreInput>
