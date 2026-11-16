import { describe, expect, it } from "vitest"

import { bundleMeta, bundleSchema } from "@/components/admin/pages/page-bundle"
import { SETTINGS_ENTRIES } from "@/lib/admin/settings-keys"
import { PAGE_SECTIONS } from "@/lib/admin/website"
import { templateEditorMeta } from "@/templates/editor-meta"
import { templates } from "@/templates/registry"

describe("page bundle: shared sections inside a page's form", () => {
  it("places each section after the group it follows on the public page", () => {
    const home = bundleSchema(templates.home.schema, PAGE_SECTIONS.home!)
    expect(Object.keys(home.shape)).toEqual([
      "hero",
      "services",
      "enquireBanner",
      "clients",
      "team",
      "blog",
      "sections",
    ])
    const contact = bundleSchema(
      templates.contact.schema,
      PAGE_SECTIONS.contact!
    )
    expect(Object.keys(contact.shape)).toEqual([
      "hero",
      "contactDetails",
      "contactSection",
      "departments",
      "sections",
    ])
  })

  it("keeps the page alone without sections", () => {
    expect(Object.keys(bundleSchema(templates.team.schema, []).shape)).toEqual(
      Object.keys(templates.team.schema.shape)
    )
  })

  it("labels each section card with its settings label", () => {
    const meta = bundleMeta(
      templateEditorMeta.services,
      PAGE_SECTIONS.services!
    )
    expect(meta.fields.whyChooseUs).toMatchObject({
      label: SETTINGS_ENTRIES["sections.whyChooseUs"].label,
    })
  })
})
