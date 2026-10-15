import "server-only"

import type { BetterAuthPlugin } from "better-auth"
import { APIError, createAuthMiddleware } from "better-auth/api"

/**
 * Project hooks for Better Auth, packaged as a plugin so they run after the
 * twoFactor plugin's hooks (plugin hooks run in plugin order; options.hooks
 * would run first and see a sign-in that twoFactor later turns into a
 * challenge). Task 3 adds the audit hooks.
 */
export function securityHooks(): BetterAuthPlugin {
  return {
    id: "sp-security",
    hooks: {
      before: [
        {
          // Admin-plugin endpoints are server-only: user management goes
          // through /api/v1/admin/users (permission checks + audit). Direct
          // HTTP calls to /api/auth/admin/* are refused; auth.api.* calls
          // from our own services carry no `request` and pass.
          matcher: (ctx) => ctx.path?.startsWith("/admin/") ?? false,
          handler: createAuthMiddleware(async (ctx) => {
            if (ctx.request) throw new APIError("NOT_FOUND")
          }),
        },
      ],
    },
  }
}
