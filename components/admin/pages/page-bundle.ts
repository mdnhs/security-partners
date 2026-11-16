import { z } from "zod"

import {
  type EditorMeta,
  EMPTY_META,
} from "@/components/admin/schema-form/editor-meta"
import { settingsEditorMeta } from "@/components/admin/settings/settings-meta"
import { SETTINGS_ENTRIES } from "@/lib/admin/settings-keys"
import type { PageSection } from "@/lib/admin/website"
import { api, unwrap } from "@/lib/api-client"
import type { PageDto } from "@/lib/schemas/api/content"
import type { SettingsDto } from "@/lib/schemas/api/settings"
import { settingsSchemas } from "@/lib/schemas/settings"
import { isDeepEqual } from "@/lib/json"
import type { PageKey } from "@/templates/registry"

/**
 * A page plus the settings sections shown inside its form. The form edits one
 * draft ({ ...page, [section.key]: settings draft }); this splits it back on
 * save and publishes the changed sections with the page. Versions of each
 * stored record are tracked here, so the editor only ever sees the page's.
 */

/** The page schema with the sections added in public order. */
export function bundleSchema(
  page: z.ZodObject,
  sections: readonly PageSection[]
): z.ZodObject {
  const shape: Record<string, z.ZodType> = {}
  const rest = [...sections]
  // A section may follow another section (Clients after Enquire banner).
  const take = (after: string | null) => {
    for (let i = 0; i < rest.length;) {
      if (rest[i].after === after) {
        const [section] = rest.splice(i, 1)
        shape[section.key] = settingsSchemas[section.settings]
        take(section.key)
        i = 0
      } else i++
    }
  }
  take(null)
  for (const [key, field] of Object.entries(page.shape)) {
    shape[key] = field as z.ZodType
    take(key)
  }
  for (const section of rest)
    shape[section.key] = settingsSchemas[section.settings]
  return z.object(shape)
}

/** Editor hints: the page's, plus each section's under its form key. */
export function bundleMeta(
  page: EditorMeta,
  sections: readonly PageSection[]
): EditorMeta {
  const fields = { ...page.fields }
  const groups = { ...page.groups }
  for (const { key, settings } of sections) {
    const own = settingsEditorMeta[settings] ?? EMPTY_META
    fields[key] = {
      label: SETTINGS_ENTRIES[settings].label,
      help: SETTINGS_ENTRIES[settings].description,
      ...fields[key],
    }
    for (const [path, meta] of Object.entries(own.fields))
      fields[`${key}.${path}`] = meta
    for (const [path, list] of Object.entries(own.groups ?? {}))
      groups[path ? `${key}.${path}` : key] = list
  }
  return { fields, groups }
}

type Pair = { dto: SettingsDto; saved: unknown }

export function createBundle(
  pageKey: PageKey,
  sections: readonly PageSection[]
) {
  const param = { key: pageKey }
  let page: PageDto | null = null
  let pageSaved: unknown = null
  const parts: Record<string, Pair> = {}

  const merged = (): PageDto => {
    const p = page!
    const entries = sections.map((s) => [s.key, parts[s.key]] as const)
    const draft = {
      ...(p.draft as object),
      ...Object.fromEntries(entries.map(([k, v]) => [k, v.dto.draft])),
    }
    const published =
      p.published === null
        ? null
        : {
            ...(p.published as object),
            ...Object.fromEntries(
              entries.map(([k, v]) => [k, v.dto.published ?? v.dto.draft])
            ),
          }
    return {
      ...p,
      draft,
      published,
      dirty: p.dirty || entries.some(([, v]) => v.dto.dirty),
    }
  }

  const adopt = (key: string, dto: SettingsDto) => {
    parts[key] = { dto, saved: dto.draft }
  }

  return {
    async load(): Promise<PageDto> {
      const [pageDto, ...dtos] = await Promise.all([
        unwrap(api.pages[":key"].$get({ param })),
        ...sections.map((s) =>
          unwrap(api.settings[":key"].$get({ param: { key: s.settings } }))
        ),
      ])
      page = pageDto
      pageSaved = pageDto.draft
      sections.forEach((s, i) => adopt(s.key, dtos[i]))
      return merged()
    },

    async saveDraft(draft: unknown, version: number): Promise<PageDto> {
      const value = draft as Record<string, unknown>
      const own = { ...value }
      for (const s of sections) delete own[s.key]
      for (const s of sections) {
        const part = parts[s.key]
        if (isDeepEqual(value[s.key], part.saved)) continue
        const dto = await unwrap(
          api.settings[":key"].draft.$put({
            param: { key: s.settings },
            json: { draft: value[s.key], version: part.dto.version },
          })
        )
        parts[s.key] = { dto, saved: value[s.key] }
      }
      // Only skip the page's own save when just a section changed: a save at
      // another version is an overwrite after a conflict and must be sent.
      if (
        sections.length === 0 ||
        version !== page!.version ||
        !isDeepEqual(own, pageSaved)
      ) {
        page = await unwrap(
          api.pages[":key"].draft.$put({
            param,
            json: { draft: own, version },
          })
        )
        pageSaved = own
      }
      return merged()
    },

    async publish(version: number): Promise<PageDto> {
      for (const s of sections) {
        const part = parts[s.key]
        if (!part.dto.dirty && part.dto.published) continue
        adopt(
          s.key,
          await unwrap(
            api.settings[":key"].publish.$post({
              param: { key: s.settings },
              json: { version: part.dto.version },
            })
          )
        )
      }
      page = await unwrap(
        api.pages[":key"].publish.$post({ param, json: { version } })
      )
      pageSaved = page.draft
      return merged()
    },

    async restore(revisionId: string, version: number): Promise<PageDto> {
      page = await unwrap(
        api.pages[":key"].restore.$post({
          param,
          json: { revisionId, version },
        })
      )
      pageSaved = page.draft
      return merged()
    },
  }
}
