import "server-only"

import { Hono } from "hono"

import type { AppEnv } from "@/server/api/context"
import { actorOf } from "@/server/api/middleware/auth"

import { getDashboard } from "./service"

/** Every signed-in user has a dashboard; the service hides what they may not see. */
export const dashboardRoutes = new Hono<AppEnv>().get("/", async (c) =>
  c.json(await getDashboard(actorOf(c)), 200)
)
