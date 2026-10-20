import "server-only"

import { getEnv } from "@/server/env"

export type SiteEnv = "development" | "staging" | "production"

const originOf = (value: string | undefined) => {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

/**
 * Spec §1.4: "production" when the BETTER_AUTH_URL origin equals
 * settings.site.productionUrl; "development" when NODE_ENV !== "production";
 * otherwise "staging". Callers pass settings.site.productionUrl.
 */
export function getSiteEnv(productionUrl?: string): SiteEnv {
  const env = getEnv()
  const production = originOf(productionUrl)
  if (production !== null && production === originOf(env.BETTER_AUTH_URL))
    return "production"
  if (env.NODE_ENV !== "production") return "development"
  return "staging"
}
