import "server-only"

import type { RequestIdVariables } from "hono/request-id"

import type { Actor } from "@/server/lib/actor"

export type AppEnv = {
  Variables: RequestIdVariables & {
    /** null until Phase 2's session middleware resolves a signed-in user. */
    actor: Actor | null
  }
}
