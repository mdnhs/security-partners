import "server-only"

import { createMiddleware } from "hono/factory"

import type { AppEnv } from "@/server/api/context"
import { actorOf } from "@/server/api/middleware/auth"
import { AppError } from "@/server/lib/errors"

/**
 * 403 while an admin is viewing the admin as someone else: view-as shows what
 * a role can see, it never acts for them. Mount after `can(...)`.
 */
export const notViewingAs = (message: string) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (actorOf(c).impersonatorId) throw new AppError("FORBIDDEN", message)
    await next()
  })
