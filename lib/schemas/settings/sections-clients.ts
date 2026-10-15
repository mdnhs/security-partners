import { z } from "zod"

import { text } from "../common"

/** settings.sections.clients — heading of the shared clients strip (D10). */
export const clientsSectionSettings = z.object({ eyebrow: text, heading: text })
export type ClientsSectionSettings = z.infer<typeof clientsSectionSettings>
