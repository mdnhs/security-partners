import "server-only"

import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"
import type { SiteSources } from "@/templates/shared/sources"

/**
 * Data for the public templates. Interim: served from the seed fixtures
 * (no database) so the props refactor can be verified on its own; the
 * next task reads it from the cached queries instead.
 */
export async function loadSiteSources(): Promise<SiteSources> {
  return fixtureSiteSources()
}
