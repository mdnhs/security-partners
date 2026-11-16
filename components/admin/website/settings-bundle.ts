import { isDeepEqual } from "@/lib/json"
import { api, unwrap } from "@/lib/api-client"
import type { EditableSettingsKey } from "@/lib/admin/settings-keys"
import type { SettingsDto } from "@/lib/schemas/api/settings"

/**
 * Several settings keys edited as one record (Header & footer): one form, one
 * draft, one Publish. The form's draft is `{ [key]: that key's draft }`; this
 * splits it back on save and publishes the changed keys together. The first
 * key is the record the editor tracks (its version, revisions and status);
 * the others' versions are tracked here, as in the page bundle.
 */
type Pair = { dto: SettingsDto; saved: unknown }

export function createSettingsBundle(keys: readonly EditableSettingsKey[]) {
  const [primaryKey, ...restKeys] = keys
  const paramOf = (key: EditableSettingsKey) => ({ key })
  let primary: SettingsDto | null = null
  let primarySaved: unknown = null
  const parts = new Map<EditableSettingsKey, Pair>()

  const merged = (): SettingsDto => {
    const p = primary!
    const draft: Record<string, unknown> = { [primaryKey]: p.draft }
    for (const key of restKeys) draft[key] = parts.get(key)!.dto.draft
    let published: Record<string, unknown> | null = null
    if (p.published !== null) {
      published = { [primaryKey]: p.published }
      for (const key of restKeys) {
        const dto = parts.get(key)!.dto
        published[key] = dto.published ?? dto.draft
      }
    }
    return {
      ...p,
      draft,
      published,
      dirty: p.dirty || restKeys.some((key) => parts.get(key)!.dto.dirty),
    }
  }

  const adopt = (key: EditableSettingsKey, dto: SettingsDto) => {
    parts.set(key, { dto, saved: dto.draft })
  }

  return {
    async load(): Promise<SettingsDto> {
      const [first, ...others] = await Promise.all(
        keys.map((key) =>
          unwrap(api.settings[":key"].$get({ param: paramOf(key) }))
        )
      )
      primary = first
      primarySaved = first.draft
      restKeys.forEach((key, i) => adopt(key, others[i]))
      return merged()
    },

    async saveDraft(draft: unknown, version: number): Promise<SettingsDto> {
      const value = draft as Record<string, unknown>
      for (const key of restKeys) {
        const part = parts.get(key)!
        if (isDeepEqual(value[key], part.saved)) continue
        const dto = await unwrap(
          api.settings[":key"].draft.$put({
            param: paramOf(key),
            json: { draft: value[key], version: part.dto.version },
          })
        )
        parts.set(key, { dto, saved: value[key] })
      }
      // Skip the primary's own save when only another key changed; a save at
      // another version is an overwrite after a conflict and must be sent.
      if (
        version !== primary!.version ||
        !isDeepEqual(value[primaryKey], primarySaved)
      ) {
        primary = await unwrap(
          api.settings[":key"].draft.$put({
            param: paramOf(primaryKey),
            json: { draft: value[primaryKey], version },
          })
        )
        primarySaved = value[primaryKey]
      }
      return merged()
    },

    async publish(version: number): Promise<SettingsDto> {
      for (const key of restKeys) {
        const part = parts.get(key)!
        if (!part.dto.dirty && part.dto.published) continue
        adopt(
          key,
          await unwrap(
            api.settings[":key"].publish.$post({
              param: paramOf(key),
              json: { version: part.dto.version },
            })
          )
        )
      }
      primary = await unwrap(
        api.settings[":key"].publish.$post({
          param: paramOf(primaryKey),
          json: { version },
        })
      )
      primarySaved = primary.draft
      return merged()
    },

    async restore(revisionId: string, version: number): Promise<SettingsDto> {
      primary = await unwrap(
        api.settings[":key"].restore.$post({
          param: paramOf(primaryKey),
          json: { revisionId, version },
        })
      )
      primarySaved = primary.draft
      return merged()
    },
  }
}
