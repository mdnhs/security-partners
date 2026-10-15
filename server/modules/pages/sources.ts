import "server-only"

import { PUBLIC_SETTINGS_KEYS } from "@/lib/schemas/settings"
import { AppError } from "@/server/lib/errors"
import { listArticles } from "@/server/modules/articles/queries"
import {
  listCategories,
  listClients,
  listGroupCompanies,
  listTeam,
} from "@/server/modules/collections/queries"
import { resolveMedia } from "@/server/modules/media/queries"
import { getPage } from "@/server/modules/pages/queries"
import { listServices } from "@/server/modules/services/queries"
import { getSettings } from "@/server/modules/settings/queries"
import { PAGE_KEYS } from "@/templates/registry"
import type { SiteSources } from "@/templates/shared/sources"

function required<T>(value: T | null, what: string): T {
  if (value === null)
    throw new AppError(
      "INTERNAL",
      `Missing published content: ${what}. Run pnpm db:seed.`
    )
  return value
}

/**
 * Everything the public templates render, from the cached queries ('use
 * cache' + tags), with media resolved to URLs. Call only after
 * `await connection()` inside <Suspense> (no database at build time).
 */
export async function loadSiteSources(): Promise<SiteSources> {
  const [
    settingsValues,
    pageRecords,
    services,
    articles,
    categories,
    team,
    clients,
    groupCompanies,
  ] = await Promise.all([
    Promise.all(PUBLIC_SETTINGS_KEYS.map((key) => getSettings(key))),
    Promise.all(PAGE_KEYS.map((key) => getPage(key))),
    listServices(),
    listArticles(),
    listCategories(),
    listTeam(),
    listClients(),
    listGroupCompanies(),
  ])
  const settings = Object.fromEntries(
    PUBLIC_SETTINGS_KEYS.map((key, i) => [
      key,
      required(settingsValues[i], `settings.${key}`),
    ])
  )
  const pages = Object.fromEntries(
    PAGE_KEYS.map((key, i) => {
      const page = required(pageRecords[i], `page ${key}`)
      return [key, { data: page.data, seo: page.seo }]
    })
  )
  return (await resolveMedia({
    settings,
    pages,
    services,
    articles,
    categories,
    team,
    clients,
    groupCompanies,
  })) as SiteSources
}
