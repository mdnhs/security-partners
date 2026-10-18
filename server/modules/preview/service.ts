import "server-only"

import { z } from "zod"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import { PREVIEW_ENTITIES, type PreviewEntity } from "@/lib/schemas/api/preview"
import { isSettingsKey } from "@/lib/schemas/settings"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { forbidden, notFound } from "@/server/lib/errors"
import { findArticleForEdit } from "@/server/modules/articles/repo"
import { findServiceById } from "@/server/modules/services/repo"
import { isPageKey, PAGE_PATHS } from "@/templates/registry"

const READ: Record<PreviewEntity, PermissionRequest> = {
  page: { page: ["read"] },
  service: { service: ["read"] },
  article: { article: ["read"] },
  settings: { settings: ["read"] },
}

/** May preview drafts at all: read permission on some previewable entity. */
export function canPreview(roles: readonly string[]): boolean {
  return PREVIEW_ENTITIES.some((entity) => hasPermission(roles, READ[entity]))
}

/**
 * Public URL that shows the record's draft. Settings (header, footer,
 * shared sections) preview on the home page.
 */
export async function previewPath(
  actor: Actor,
  entity: PreviewEntity,
  id: string
): Promise<string> {
  if (!hasPermission(actor.roles, READ[entity])) throw forbidden()
  switch (entity) {
    case "page":
      if (!isPageKey(id)) throw notFound("Page")
      return PAGE_PATHS[id]
    case "service": {
      // services.id is a uuid column: a malformed id would be a 500, not a 404.
      if (!z.uuid().safeParse(id).success) throw notFound("Service")
      const service = await findServiceById(getDb(), id)
      if (!service) throw notFound("Service")
      return `/services/${service.slug}`
    }
    case "article": {
      const article = z.uuid().safeParse(id).success
        ? await findArticleForEdit(getDb(), id)
        : null
      if (!article) throw notFound("Article")
      // In draft mode the public queries read drafts: unpublished articles show too.
      return `/blog/${article.slug}`
    }
    case "settings":
      if (!isSettingsKey(id)) throw notFound("Settings")
      return "/"
  }
}

/** Path of a same-origin public page (Referer) to return to after preview, else "/". */
export function safeReturnPath(
  referer: string | null | undefined,
  appOrigin: string
): string {
  if (!referer) return "/"
  let url: URL
  try {
    url = new URL(referer)
  } catch {
    return "/"
  }
  if (url.origin !== appOrigin) return "/"
  // "//host" or "/\\host" would leave the site as a protocol-relative URL.
  if (!/^\/(?![/\\])/.test(url.pathname)) return "/"
  if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/api"))
    return "/"
  return `${url.pathname}${url.search}`
}
