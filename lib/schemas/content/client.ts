import { z } from "zod"

import { httpUrl, mediaRef, text } from "../common"

export const clientSchema = z.object({
  name: text,
  logo: mediaRef,
  url: httpUrl.nullable(),
})
export type ClientInput = z.infer<typeof clientSchema>
