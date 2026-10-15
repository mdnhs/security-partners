import "server-only"

import { articlesFixture } from "./articles"
import { AUTHORS } from "./authors"
import { CATEGORIES } from "./categories"
import { clientsFixture } from "./clients"
import { groupCompaniesFixture } from "./group-companies"
import type { MediaLookup } from "./media"
import { pagesFixture } from "./pages"
import { servicesFixture } from "./services"
import { settingsFixture } from "./settings"
import { teamFixture } from "./team"

/** Every seed fixture, with media references resolved through `media`. */
export function contentFixtures(media: MediaLookup) {
  return {
    settings: settingsFixture(media),
    pages: pagesFixture(media),
    services: servicesFixture(media),
    categories: CATEGORIES,
    authors: AUTHORS,
    articles: articlesFixture(media),
    team: teamFixture(media),
    clients: clientsFixture(media),
    groupCompanies: groupCompaniesFixture(media),
  }
}

export type ContentFixtures = ReturnType<typeof contentFixtures>
