import "server-only"

import { getPublishedSettings } from "@/server/modules/settings/queries"
import {
  type ApplyRetention,
  DEFAULT_RETENTION,
} from "@/templates/careers/apply-view"

/** Settings › Careers retention for the apply form's privacy copy (never the recipients). */
export async function getApplyRetention(): Promise<ApplyRetention> {
  const careers = await getPublishedSettings("careers")
  return careers
    ? { months: careers.retentionMonths, keepMonths: careers.keepOnFileMonths }
    : DEFAULT_RETENTION
}
