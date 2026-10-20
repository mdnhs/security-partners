import { z } from "zod"

/**
 * settings.tracking — off by default; Phase 8 loads scripts only after
 * consent. `enabled` shows the consent banner; each channel also needs its
 * own switch (values saved before the switches existed parse as off).
 */
export const trackingSettings = z.object({
  enabled: z.boolean(),
  gtmEnabled: z.boolean().default(false),
  gtmId: z
    .string()
    .regex(/^GTM-[A-Z0-9]+$/, "Looks like GTM-XXXXXXX")
    .nullable(),
  ga4Enabled: z.boolean().default(false),
  ga4Id: z
    .string()
    .regex(/^G-[A-Z0-9]+$/, "Looks like G-XXXXXXXXXX")
    .nullable(),
  metaEnabled: z.boolean().default(false),
  metaPixelId: z.string().regex(/^\d+$/, "Digits only").nullable(),
})
export type TrackingSettings = z.infer<typeof trackingSettings>
