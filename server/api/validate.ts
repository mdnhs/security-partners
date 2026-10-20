import "server-only"

import { zValidator } from "@hono/zod-validator"
import type { ValidationTargets } from "hono"
import type { z } from "zod"

import { AppError, fieldErrorsFromIssues } from "@/server/lib/errors"

/** zValidator that throws AppError("VALIDATION_FAILED") → 422 envelope with fieldErrors. */
export const zv = <Target extends keyof ValidationTargets, T extends z.ZodType>(
  target: Target,
  schema: T
) =>
  zValidator(target, schema, (result) => {
    if (!result.success) {
      throw new AppError("VALIDATION_FAILED", "Invalid input", {
        fieldErrors: fieldErrorsFromIssues(result.error.issues),
      })
    }
  })
