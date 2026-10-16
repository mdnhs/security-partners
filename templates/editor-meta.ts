import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"

import { aboutEditorMeta } from "./about/editor-meta"
import { blogEditorMeta } from "./blog/editor-meta"
import { contactEditorMeta } from "./contact/editor-meta"
import { homeEditorMeta } from "./home/editor-meta"
import { legalEditorMeta } from "./legal/editor-meta"
import { servicesEditorMeta } from "./services/editor-meta"
import type { TemplateName } from "./registry"
import { teamEditorMeta } from "./team/editor-meta"

/** Editor hints per template (SchemaForm meta). */
export const templateEditorMeta: Record<TemplateName, EditorMeta> = {
  home: homeEditorMeta,
  about: aboutEditorMeta,
  services: servicesEditorMeta,
  team: teamEditorMeta,
  blog: blogEditorMeta,
  contact: contactEditorMeta,
  legal: legalEditorMeta,
}
