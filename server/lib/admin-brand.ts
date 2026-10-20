import "server-only"

import type { AdminBrand } from "@/components/admin/shell/constants"
import { getMedia } from "@/server/modules/media/queries"
import { getPublishedSettings } from "@/server/modules/settings/queries"

/**
 * The sidebar brand (owner request): the PUBLISHED settings.site logo, its
 * dark variant and Lottie animation, media resolved to URLs like the public
 * header (templates/shared/views.ts chromeView). Both readers are cached
 * ("use cache", settings/media tags), so a navigation costs no query.
 * Public information: no permission check. Optional: no published settings,
 * a missing logo row or a failing query leaves null (the SP chip) instead
 * of failing the frame; a missing dark logo or animation is just left out.
 */
export async function loadAdminBrand(): Promise<AdminBrand | null> {
  try {
    const site = await getPublishedSettings("site")
    if (!site) return null
    const [logo, onDark, animation] = await Promise.all([
      getMedia(site.logo.mediaId),
      site.logoOnDark ? getMedia(site.logoOnDark.mediaId) : null,
      site.logoAnimation ? getMedia(site.logoAnimation.mediaId) : null,
    ])
    if (!logo) return null
    return {
      name: site.name,
      logo: {
        src: logo.url,
        alt: site.logoAlt,
        width: logo.width,
        height: logo.height,
      },
      logoOnDark: onDark?.url ?? null,
      animation: animation?.url ?? null,
    }
  } catch (error) {
    console.error("[admin shell] brand logo unavailable", error)
    return null
  }
}
