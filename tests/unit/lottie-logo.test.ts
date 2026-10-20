import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { LOTTIE_WASM_URL } from "@/components/home/logo-animation"
import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"
import { chromeView } from "@/templates/shared/views"

import pkg from "../../package.json"

const sha = (path: string) =>
  createHash("sha256")
    .update(readFileSync(new URL(`../../${path}`, import.meta.url)))
    .digest("hex")

describe("animated logo plumbing", () => {
  it("chrome props carry no animation key while logoAnimation is null", () => {
    const { header, footer } = chromeView(fixtureSiteSources())
    expect(header.logo).toEqual({
      src: "/images/logo.png",
      alt: "Security Partners Ltd.",
    })
    expect(footer.logo).toEqual(header.logo)
    expect(Object.keys(header.logo)).not.toContain("animation")
  })

  it("chrome props pass the Lottie URL to header and footer when set", () => {
    const s = fixtureSiteSources()
    const animated = {
      ...s,
      settings: {
        ...s.settings,
        site: {
          ...s.settings.site,
          logoAnimation: {
            id: "x",
            url: "/api/v1/media/file/2026/10/logo.json",
            alt: "",
            width: 112,
            height: 68,
            blurDataUrl: null,
          },
        },
      },
    }
    const { header, footer } = chromeView(animated)
    expect(header.logo.animation).toBe("/api/v1/media/file/2026/10/logo.json")
    expect(footer.logo.animation).toBe("/api/v1/media/file/2026/10/logo.json")
  })

  it("the self-hosted player WASM is the pinned package's own file", () => {
    const version = pkg.dependencies["@lottiefiles/dotlottie-web"]
    expect(version).toBe("0.80.0")
    expect(LOTTIE_WASM_URL).toBe(
      `/vendor/dotlottie-web/${version}/dotlottie-player.wasm`
    )
    expect(sha(`public${LOTTIE_WASM_URL}`)).toBe(
      sha("node_modules/@lottiefiles/dotlottie-web/dist/dotlottie-player.wasm")
    )
  })
})
