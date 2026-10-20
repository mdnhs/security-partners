import "server-only"

import { Hono } from "hono"

import type { AppEnv } from "@/server/api/context"
import { pingDb } from "@/server/db/client"

/** Liveness never touches the DB (Docker HEALTHCHECK). Readiness pings Postgres. */
export const healthRoutes = new Hono<AppEnv>()
  .get("/live", (c) => {
    c.header("Cache-Control", "no-store")
    return c.json({ status: "ok" as const }, 200)
  })
  .get("/", async (c) => {
    c.header("Cache-Control", "no-store")
    if (await pingDb())
      return c.json({ status: "ok" as const, db: "ok" as const }, 200)
    return c.json({ status: "unavailable" as const }, 503)
  })
