import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { ADMIN_DEFAULT, buildAdminTokens } from "@/lib/theme/admin"
import { parseColor, sameColor, toHex } from "@/lib/theme/color"
import { PRESET_IDS, PRESETS, SP_SITE } from "@/lib/theme/presets"
import { DEFAULT_THEME } from "@/lib/theme/schema"
import {
  presetSiteTheme,
  resolveSiteTokens,
  SITE_DEFAULT,
} from "@/lib/theme/site"
import {
  ADMIN_TOKEN_NAMES,
  SP_ADMIN_DARK,
  SP_ADMIN_LIGHT,
} from "@/lib/theme/sp-admin"
import { ADMIN_TOKENS, SITE_SURFACES, SITE_TOKENS } from "@/lib/theme/tokens"

const globals = readFileSync(
  path.join(import.meta.dirname, "../../../app/globals.css"),
  "utf8"
)

describe("base tables", () => {
  it("SP_SITE equals app/globals.css brand tokens (ruling 4)", () => {
    for (const t of SITE_TOKENS)
      expect(globals).toContain(`--color-${t}: ${SP_SITE[t]};`)
    expect(Object.keys(SP_SITE).sort()).toEqual([...SITE_TOKENS].sort())
  })

  it("SP_ADMIN parses into ADMIN_DEFAULT unchanged", () => {
    for (const t of ADMIN_TOKENS) {
      expect(toHex(ADMIN_DEFAULT.light[t]), t).toBe(SP_ADMIN_LIGHT[t])
      expect(toHex(ADMIN_DEFAULT.dark[t]), t).toBe(
        SP_ADMIN_DARK[t] ?? SP_ADMIN_LIGHT[t]
      )
    }
  })

  it("ADMIN_TOKENS is the one A1 list", () => {
    expect(ADMIN_TOKENS).toBe(ADMIN_TOKEN_NAMES)
    expect(ADMIN_TOKENS).toHaveLength(48)
  })

  it("SITE_SURFACES are the page backgrounds", () => {
    expect([...SITE_SURFACES].sort()).toEqual(
      ["brand-map", "brand-mint", "brand-surface"].sort()
    )
  })

  it("SITE_DEFAULT is SP_SITE", () => {
    for (const t of SITE_TOKENS)
      expect(toHex(SITE_DEFAULT[t]), t).toBe(SP_SITE[t])
  })
})

describe("presets", () => {
  it("lists the six presets with SP first", () => {
    expect(PRESET_IDS).toEqual([
      "security-partners",
      "evergreen",
      "ocean",
      "plum",
      "terracotta",
      "graphite",
    ])
    expect(PRESETS["security-partners"].site.brand).toBe("#67bd31")
    expect(PRESETS["security-partners"].admin.primary).toBe("#367318")
    expect(DEFAULT_THEME.site.preset).toBe("security-partners")
    expect(DEFAULT_THEME.admin.preset).toBe("security-partners")
  })

  it("a site preset moves only the green family", () => {
    for (const id of PRESET_IDS) {
      const tokens = resolveSiteTokens(presetSiteTheme(id))
      for (const t of SITE_TOKENS) {
        const green = [
          "brand-green",
          "brand-green-dark",
          "brand-mint",
        ].includes(t)
        if (!green)
          expect(sameColor(tokens[t], SITE_DEFAULT[t]), `${id} ${t}`).toBe(true)
      }
      expect(toHex(tokens["brand-green"])).toBe(
        toHex(parseColor(PRESETS[id].site.brand)!)
      )
    }
  })

  it("locked site tokens win over the derived ones", () => {
    const tokens = resolveSiteTokens({
      ...DEFAULT_THEME.site,
      brand: "oklch(0.47 0.09 250)",
      tokens: { "brand-navy": "oklch(0.2 0.05 260)" },
    })
    expect(tokens["brand-navy"]).toEqual({ l: 0.2, c: 0.05, h: 260 })
  })
})

describe("shared tables are never handed out", () => {
  it("defaults, presets and the default theme are frozen all the way down", () => {
    for (const shared of [
      ADMIN_DEFAULT.light.primary,
      ADMIN_DEFAULT.dark.foreground,
      SITE_DEFAULT["brand-green"],
      SITE_DEFAULT,
      PRESETS.ocean.site,
      SP_SITE,
      DEFAULT_THEME.site.tokens,
      DEFAULT_THEME.admin,
    ])
      expect(Object.isFrozen(shared)).toBe(true)
    expect(() => {
      ;(SITE_DEFAULT["brand-green"] as { l: number }).l = 0.1
    }).toThrow(TypeError)
  })

  it("resolved tokens are fresh objects a caller may edit", () => {
    for (const id of PRESET_IDS) {
      const site = resolveSiteTokens(presetSiteTheme(id))
      const admin = buildAdminTokens(
        { ...DEFAULT_THEME.admin, preset: id, accent: "#3366cc" },
        "dark"
      )
      for (const t of SITE_TOKENS) {
        expect(Object.isFrozen(site[t])).toBe(false)
        site[t].l = 0.5
      }
      for (const t of ADMIN_TOKENS) {
        expect(Object.isFrozen(admin[t])).toBe(false)
        admin[t].l = 0.5
      }
      // One token never aliases another.
      expect(admin.accent).not.toBe(admin["sidebar-accent"])
    }
    expect(toHex(resolveSiteTokens(DEFAULT_THEME.site)["brand-green"])).toBe(
      "#67bd31"
    )
    expect(buildAdminTokens(DEFAULT_THEME.admin, "dark").foreground).toEqual(
      ADMIN_DEFAULT.dark.foreground
    )
    expect(SITE_DEFAULT["brand-green"].l).not.toBe(0.5)
  })
})
