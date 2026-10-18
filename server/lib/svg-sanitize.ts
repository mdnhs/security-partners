import "server-only"

import createDOMPurify, { type WindowLike } from "dompurify"
import { JSDOM } from "jsdom"

export class SvgSanitizeError extends Error {}

/** Internal references and inline raster images only: nothing is fetched from elsewhere. */
const SAFE_REFERENCE =
  /^(?:#[A-Za-z_][\w.-]*|data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=\s]+)$/

type Purifier = {
  purify: ReturnType<typeof createDOMPurify>
  window: JSDOM["window"]
}
let instance: Purifier | null = null

function purifier(): Purifier {
  if (instance) return instance
  const { window } = new JSDOM("")
  const purify = createDOMPurify(window as unknown as WindowLike)
  purify.addHook("uponSanitizeAttribute", (_node, data) => {
    if (
      (data.attrName === "href" || data.attrName === "xlink:href") &&
      !SAFE_REFERENCE.test(data.attrValue.trim())
    )
      data.keepAttr = false
  })
  instance = { purify, window }
  return instance
}

/**
 * Spec §11 "SVG sanitised": DOMPurify's SVG profiles (no script, handlers,
 * animation of attributes), plus no <style> (remote @import), no
 * <foreignObject>, no links, no remote href. Returns one well-formed
 * <svg> element serialised as XML (image/svg+xml must parse as XML).
 */
export function sanitizeSvg(source: string): string {
  const { purify, window } = purifier()
  const fragment = purify.sanitize(source, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["style", "foreignObject", "a", "use"],
    RETURN_DOM_FRAGMENT: true,
  })
  const elements = [...fragment.children]
  if (elements.length !== 1 || elements[0].nodeName.toLowerCase() !== "svg")
    throw new SvgSanitizeError("The file is not a single SVG image")
  return new window.XMLSerializer().serializeToString(elements[0])
}
