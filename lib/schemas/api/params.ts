import { z } from "zod"

/** `/:id` path parameter (uuid v7 ids; any uuid version accepted). */
export const idParam = z.object({ id: z.uuid() })
