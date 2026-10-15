import { z } from "zod"

import { mediaRef, text } from "../common"

export const clientSchema = z.object({
  name: text,
  logo: mediaRef,
  url: z.url().nullable(),
})
export type ClientInput = z.infer<typeof clientSchema>
