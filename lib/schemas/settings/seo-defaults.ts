import { z } from "zod"

import { mediaRef, text } from "../common"

/** settings.seo.defaults — site title, "{title} | …" template, default description. */
export const seoDefaultsSettings = z.object({
  title: text,
  titleTemplate: text,
  description: text,
  ogImage: mediaRef.nullable(),
})
export type SeoDefaultsSettings = z.infer<typeof seoDefaultsSettings>
