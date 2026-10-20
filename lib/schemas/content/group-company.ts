import { z } from "zod"

import { mediaRef, text } from "../common"

/** Footer "Other services in the group"; tel: href derived from phone, link is https://{site}. */
export const groupCompanySchema = z.object({
  name: text,
  phone: text,
  site: z
    .string()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Domain only, e.g. www.example.ie"),
  logo: mediaRef,
})
export type GroupCompanyInput = z.infer<typeof groupCompanySchema>
