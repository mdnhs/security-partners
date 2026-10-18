import { z } from "zod"

/** POST /api/v1/internal/revalidate (scheduler → itself). */
export const revalidateInput = z.object({
  tags: z.array(z.string().min(1).max(200)).min(1).max(100),
})
