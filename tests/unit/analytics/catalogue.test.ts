import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { ANALYTICS_EVENTS, EVENT_CATALOGUE } from "@/lib/analytics/events"

/**
 * MK parity D2.4: the event catalogue (admin page) and the GTM container
 * export (docs/gtm-container.json) describe the same events, so a new
 * ANALYTICS_EVENTS entry fails here until both are updated.
 */

type GtmParameter = {
  type: string
  key: string
  value?: string
  list?: { type: string; map: GtmParameter[] }[]
}
type GtmTrigger = {
  triggerId: string
  name: string
  type: string
  customEventFilter?: { type: string; parameter: GtmParameter[] }[]
}
type GtmTag = {
  tagId: string
  name: string
  type: string
  parameter: GtmParameter[]
  firingTriggerId: string[]
}
type GtmVariable = {
  variableId: string
  name: string
  type: string
  parameter: GtmParameter[]
}
type GtmExport = {
  exportFormatVersion: number
  containerVersion: {
    tag: GtmTag[]
    trigger: GtmTrigger[]
    variable: GtmVariable[]
    builtInVariable: { type: string; name: string }[]
  }
}

const gtm = JSON.parse(
  readFileSync(join(process.cwd(), "docs/gtm-container.json"), "utf8")
) as GtmExport
const {
  tag: tags,
  trigger: triggers,
  variable: variables,
} = gtm.containerVersion

const param = (list: GtmParameter[], key: string) =>
  list.find((p) => p.key === key)

/** The `{{_event}} equals <name>` Custom Event trigger, if any. */
const triggerFor = (event: string) =>
  triggers.find(
    (t) =>
      t.type === "CUSTOM_EVENT" &&
      t.customEventFilter?.some(
        (f) =>
          f.type === "EQUALS" &&
          param(f.parameter, "arg0")?.value === "{{_event}}" &&
          param(f.parameter, "arg1")?.value === event
      )
  )

/** The Data Layer Variable reading `key`, if any. */
const dlvFor = (key: string) =>
  variables.find(
    (v) =>
      v.type === "v" &&
      param(v.parameter, "name")?.value === key &&
      param(v.parameter, "dataLayerVersion")?.value === "2"
  )

describe("EVENT_CATALOGUE", () => {
  it("has exactly one row per ANALYTICS_EVENTS entry", () => {
    const events = EVENT_CATALOGUE.map((row) => row.event)
    expect([...events].sort()).toEqual([...ANALYTICS_EVENTS].sort())
    expect(new Set(events).size).toBe(events.length)
  })

  it("rows (D2.4 brief, verbatim)", () => {
    expect(EVENT_CATALOGUE).toEqual([
      {
        event: "page_view_virtual",
        firesWhen: "each page change after the first",
        params: ["page_path", "page_title"],
        ga4: "page_view",
        meta: "PageView",
      },
      {
        event: "lead_submitted",
        firesWhen: "the contact form was accepted",
        params: ["source_page"],
        ga4: "generate_lead",
        meta: "Lead",
      },
      {
        event: "cta_click",
        firesWhen: "links to /contact",
        params: ["link_text", "link_url"],
        ga4: "select_content",
        meta: null,
      },
      {
        event: "phone_click",
        firesWhen: "tel: links",
        params: ["link_url"],
        ga4: "contact",
        meta: "Contact",
      },
      {
        event: "email_click",
        firesWhen: "mailto: links",
        params: ["link_url"],
        ga4: "contact",
        meta: "Contact",
      },
      {
        event: "tracking_test",
        firesWhen: "the admin's Send test event",
        params: ["test_id"],
        ga4: "tracking_test",
        meta: null,
      },
    ])
  })

  it("includes the SPA page view and the admin test event", () => {
    expect(ANALYTICS_EVENTS).toContain("page_view_virtual")
    expect(ANALYTICS_EVENTS).toContain("tracking_test")
  })
})

describe("docs/gtm-container.json", () => {
  it("is a GTM container export (format 2) using the built-in Event variable", () => {
    expect(gtm.exportFormatVersion).toBe(2)
    expect(gtm.containerVersion.builtInVariable).toContainEqual(
      expect.objectContaining({ type: "EVENT", name: "Event" })
    )
  })

  it("has a Custom Event trigger for every catalogue event", () => {
    for (const row of EVENT_CATALOGUE)
      expect(triggerFor(row.event), row.event).toBeDefined()
    expect(triggers).toHaveLength(EVENT_CATALOGUE.length)
  })

  it("has a GA4 Event tag per row, fired by its trigger, sending its params", () => {
    expect(tags).toHaveLength(EVENT_CATALOGUE.length)
    for (const row of EVENT_CATALOGUE) {
      const trigger = triggerFor(row.event)!
      const tag = tags.find((t) =>
        t.firingTriggerId.includes(trigger.triggerId)
      )
      expect(tag, row.event).toBeDefined()
      expect(tag!.type).toBe("gaawe")
      expect(param(tag!.parameter, "eventName")?.value).toBe(row.ga4)
      expect(param(tag!.parameter, "measurementIdOverride")?.value).toBe(
        "{{GA4 Measurement ID}}"
      )
      const sent = (
        param(tag!.parameter, "eventSettingsTable")?.list ?? []
      ).map((entry) => [
        param(entry.map, "parameter")?.value,
        param(entry.map, "parameterValue")?.value,
      ])
      expect(sent).toEqual(
        row.params.map((key) => [key, `{{${dlvFor(key)?.name}}}`])
      )
    }
  })

  it("has a Data Layer Variable for every param", () => {
    for (const key of new Set(EVENT_CATALOGUE.flatMap((row) => row.params)))
      expect(dlvFor(key), key).toBeDefined()
  })

  it("ids are unique and every reference resolves", () => {
    const unique = (ids: string[]) => new Set(ids).size === ids.length
    expect(unique(tags.map((t) => t.tagId))).toBe(true)
    expect(unique(triggers.map((t) => t.triggerId))).toBe(true)
    expect(unique(variables.map((v) => v.variableId))).toBe(true)
    const names = new Set([
      ...variables.map((v) => v.name),
      ...gtm.containerVersion.builtInVariable.map((v) => v.name),
      "_event",
    ])
    const refs = JSON.stringify(gtm).match(/\{\{[^}]+\}\}/g) ?? []
    for (const ref of refs) expect(names, ref).toContain(ref.slice(2, -2))
  })
})
