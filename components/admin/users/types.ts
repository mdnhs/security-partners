import type { InferResponseType } from "hono/client"

import type { api } from "@/lib/api-client"

// Response shapes of /api/v1/admin/users, inferred from the Hono routes
// (server/modules/users/schema.ts) so the UI never imports server code.
export type UserItem = InferResponseType<
  typeof api.users.$get,
  200
>["items"][number]
export type UserSessionItem = InferResponseType<
  (typeof api.users)[":id"]["sessions"]["$get"],
  200
>["items"][number]
export type InviteResult = InferResponseType<typeof api.users.invite.$post, 201>
export type PasswordLinkResult = InferResponseType<
  (typeof api.users)[":id"]["password-link"]["$post"],
  200
>
