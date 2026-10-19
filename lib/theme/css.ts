// lib/theme/css.ts
import { ADMIN_DEFAULT, buildAdminTokens } from "./admin"
import { formatOklch, type Oklch } from "./color"
import type { AdminThemeConfig, SiteThemeConfig } from "./schema"
import { resolveSiteTokens, SITE_DEFAULT } from "./site"
import { SP_ADMIN_RADIUS } from "./sp-admin"

// :root for the public site (globals.css @theme), the admin's own scopes
// (app/(admin)/admin/admin.css).
export const SCOPES = {
  site: ":root",
  admin: "html[data-admin]",
  adminDark: "html[data-admin].dark",
} as const
type Selector = (typeof SCOPES)[keyof typeof SCOPES]

const NAME = /^[a-z][a-z0-9-]*$/
const finite = (c: Oklch) => [c.l, c.c, c.h].every(Number.isFinite)

// Every declaration is rebuilt from numbers: no stored string reaches the
// <style> tag.
export function toCss(
  selector: Selector,
  tokens: Record<string, Oklch>,
  extra: string[] = []
): string {
  const decls = Object.entries(tokens)
    .filter(([name, color]) => NAME.test(name) && finite(color))
    .map(([name, color]) => `--${name}:${formatOklch(color)}`)
  const all = [...decls, ...extra]
  return all.length ? `${selector}{${all.join(";")}}` : ""
}

function changed<K extends string>(
  tokens: Record<K, Oklch>,
  base: Record<K, Oklch>,
  prefix = ""
): Record<string, Oklch> {
  return Object.fromEntries(
    (Object.keys(tokens) as K[])
      .filter((k) => formatOklch(tokens[k]) !== formatOklch(base[k]))
      .map((k) => [`${prefix}${k}`, tokens[k]])
  )
}

// Ruling 4: only what differs from globals.css, so the default emits "".
export function siteThemeCss(site: SiteThemeConfig): string {
  return toCss(
    SCOPES.site,
    changed(resolveSiteTokens(site), SITE_DEFAULT, "color-")
  )
}

const radiusDecl = (radius: number) =>
  Number.isFinite(radius) && radius >= 0 && radius <= 1.5
    ? `--radius:${radius}rem`
    : null

export function adminThemeCss(admin: AdminThemeConfig): string {
  const radius =
    admin.radius !== SP_ADMIN_RADIUS ? radiusDecl(admin.radius) : null
  return (
    toCss(
      SCOPES.admin,
      changed(buildAdminTokens(admin, "light"), ADMIN_DEFAULT.light),
      radius ? [radius] : []
    ) +
    toCss(
      SCOPES.adminDark,
      changed(buildAdminTokens(admin, "dark"), ADMIN_DEFAULT.dark)
    )
  )
}

// The Appearance page's live preview: every token, set inline on <html>.
export function liveDeclarations(
  admin: AdminThemeConfig,
  mode: "light" | "dark"
): [string, string][] {
  const tokens = buildAdminTokens(admin, mode)
  const radius = radiusDecl(admin.radius)
  return [
    ...Object.entries(tokens).map(
      ([name, color]) => [`--${name}`, formatOklch(color)] as [string, string]
    ),
    ...(radius ? [["--radius", `${admin.radius}rem`] as [string, string]] : []),
  ]
}
