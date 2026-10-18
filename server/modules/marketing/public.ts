import "server-only"

import {
  type ConsentSettings,
  consentSettings,
} from "@/lib/schemas/settings/consent"
import {
  type CustomCodeSettings,
  customCodeSettings,
} from "@/lib/schemas/settings/custom-code"
import {
  type TrackingSettings,
  trackingSettings,
} from "@/lib/schemas/settings/tracking"
import { getPublishedSettings } from "@/server/modules/settings/queries"

export type PublicMarketing = {
  tracking: TrackingSettings
  consent: ConsentSettings | null
  customCode: CustomCodeSettings
}

const TRACKING_OFF: TrackingSettings = {
  enabled: false,
  gtmId: null,
  ga4Id: null,
  metaPixelId: null,
}
const NO_CODE: CustomCodeSettings = { headHtml: "", bodyEndHtml: "" }

/**
 * Tracking, consent copy and custom code as the public site uses them:
 * published values only (never drafts, never draft mode); anything that
 * does not validate counts as off/empty.
 */
export async function loadPublicMarketing(): Promise<PublicMarketing> {
  const [tracking, consent, customCode] = await Promise.all([
    getPublishedSettings("tracking"),
    getPublishedSettings("consent"),
    getPublishedSettings("customCode"),
  ])
  const t = trackingSettings.safeParse(tracking)
  const c = consentSettings.safeParse(consent)
  const code = customCodeSettings.safeParse(customCode)
  return {
    tracking: t.success ? t.data : TRACKING_OFF,
    consent: c.success ? c.data : null,
    customCode: code.success ? code.data : NO_CODE,
  }
}
