import "server-only"

import { requestId } from "hono/request-id"
import { uuidv7 } from "uuidv7"

/** Reuses a sane incoming X-Request-Id, otherwise a uuid v7. Echoed in the X-Request-Id response header. */
export const requestIdMiddleware = requestId({ generator: () => uuidv7() })
