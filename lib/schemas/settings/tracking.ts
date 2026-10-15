import { z } from "zod"

/** settings.tracking — off by default; Phase 8 loads scripts only after consent. */
export const trackingSettings = z.object({
  enabled: z.boolean(),
  gtmId: z
    .string()
    .regex(/^GTM-[A-Z0-9]+$/, "Looks like GTM-XXXXXXX")
    .nullable(),
  ga4Id: z
    .string()
    .regex(/^G-[A-Z0-9]+$/, "Looks like G-XXXXXXXXXX")
    .nullable(),
  metaPixelId: z.string().regex(/^\d+$/, "Digits only").nullable(),
})
export type TrackingSettings = z.infer<typeof trackingSettings>
