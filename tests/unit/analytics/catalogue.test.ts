import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  ANALYTICS_EVENTS,
  EVENT_CATALOGUE,
  GTM_SETUP_STEPS,
} from "@/lib/analytics/events"

/** GTM's built-in "Initialization - All Pages" trigger. */
const INITIALIZATION_ALL_PAGES = "2147479573"
/**
 * The page URL without query or hash, from GTM variables. The scheme is the
 * page's own (review D2.4 N4), so http previews and localhost are right too.
 */
const CLEAN_PAGE_LOCATION = "{{Page Protocol}}://{{Page Hostname}}{{Page Path}}"

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
    expect(tags.filter((t) => t.type === "gaawe")).toHaveLength(
      EVENT_CATALOGUE.length
    )
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
      expect(sent).toEqual([
        ...row.params.map((key) => [key, `{{${dlvFor(key)?.name}}}`]),
        // GA4 would otherwise attach the full URL, query string included.
        ["page_location", CLEAN_PAGE_LOCATION],
      ])
    }
  })

  it("has one Google tag (GA4 config) on Initialization - All Pages, without the query", () => {
    const google = tags.filter((t) => t.type === "googtag")
    expect(google).toHaveLength(1)
    const tag = google[0]!
    expect(tag.firingTriggerId).toEqual([INITIALIZATION_ALL_PAGES])
    expect(param(tag.parameter, "tagId")?.value).toBe("{{GA4 Measurement ID}}")
    const settings = (
      param(tag.parameter, "configSettingsTable")?.list ?? []
    ).map((entry) => [
      param(entry.map, "parameter")?.value,
      param(entry.map, "parameterValue")?.value,
    ])
    expect(settings).toEqual([["page_location", CLEAN_PAGE_LOCATION]])
  })

  it("the description carries the setup steps shown on the events page", () => {
    const description = (
      gtm.containerVersion as unknown as { description: string }
    ).description
    expect(GTM_SETUP_STEPS[0]).toContain(
      "turn off 'Page changes based on browser history events'"
    )
    for (const step of GTM_SETUP_STEPS) expect(description).toContain(step)
  })

  it("ships placeholder IDs only", () => {
    const { container } = gtm.containerVersion as unknown as {
      container: { publicId: string }
    }
    expect(container.publicId).toBe("GTM-XXXXXXX")
    const measurement = variables.find((v) => v.name === "GA4 Measurement ID")!
    expect(param(measurement.parameter, "value")?.value).toMatch(/^G-X+$/)
  })

  it("Page Protocol is a URL variable reading the page's protocol (D2.4 N4)", () => {
    const protocol = variables.find((v) => v.name === "Page Protocol")
    expect(protocol).toBeDefined()
    expect(protocol!.type).toBe("u")
    expect(param(protocol!.parameter, "component")?.value).toBe("PROTOCOL")
    expect(JSON.stringify(gtm)).not.toContain("https://{{")
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
    const triggerIds = new Set([
      ...triggers.map((t) => t.triggerId),
      INITIALIZATION_ALL_PAGES,
    ])
    for (const tag of tags)
      for (const id of tag.firingTriggerId)
        expect(triggerIds, tag.name).toContain(id)
  })
})

describe("no real tag IDs committed (D2.4 minor 5)", () => {
  // GTM-…, G-… (GA4) and AW-… (Ads) IDs; all-X values are the placeholders.
  const TAG_ID = /\b(?:GTM|G|AW)-[A-Z0-9]{4,}\b/g
  const PLACEHOLDER = /^(?:GTM|G|AW)-X+$/
  // scripts/ holds the seeds (review D2.4 N5); tests/ and e2e/ are left out
  // on purpose: their fixtures (GTM-TEST1, G-TEST1) look like real IDs.
  const ROOTS = [
    "app",
    "components",
    "lib",
    "server",
    "templates",
    "hooks",
    "scripts",
  ]
  const CODE = /\.(?:[cm]?[jt]sx?|json|sql|css)$/

  function files(dir: string): string[] {
    return readdirSync(join(process.cwd(), dir), {
      recursive: true,
      encoding: "utf8",
    })
      .filter((f) => CODE.test(f))
      .map((f) => join(dir, f))
  }

  /** Config files at the repo root (next.config.ts, package.json, …). */
  function rootConfigs(): string[] {
    return readdirSync(process.cwd(), { withFileTypes: true })
      .filter((e) => e.isFile() && CODE.test(e.name))
      .map((e) => e.name)
  }

  it("scans scripts/ and the root config files too (D2.4 N5)", () => {
    expect(ROOTS).toContain("scripts")
    expect(rootConfigs()).toContain("package.json")
    expect(rootConfigs()).toContain("next.config.ts")
  })

  it("the container and the app code hold placeholders only", () => {
    const found: string[] = []
    for (const file of [
      "docs/gtm-container.json",
      ...rootConfigs(),
      ...ROOTS.filter((d) => existsSync(join(process.cwd(), d))).flatMap(files),
    ]) {
      const text = readFileSync(join(process.cwd(), file), "utf8")
      for (const id of text.match(TAG_ID) ?? [])
        if (!PLACEHOLDER.test(id)) found.push(`${file}: ${id}`)
    }
    expect(found).toEqual([])
  })

  it("the pattern would catch a real-looking ID", () => {
    expect("GTM-K7Q2ZP4 G-1A2B3C4D5E".match(TAG_ID)).toEqual([
      "GTM-K7Q2ZP4",
      "G-1A2B3C4D5E",
    ])
    expect(PLACEHOLDER.test("GTM-XXXXXXX")).toBe(true)
  })
})
