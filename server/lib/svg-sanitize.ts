import "server-only"

import createDOMPurify, { type WindowLike } from "dompurify"
import { JSDOM } from "jsdom"

export class SvgSanitizeError extends Error {}

/** Internal references and inline raster images only: nothing is fetched from elsewhere. */
const SAFE_REFERENCE =
  /^(?:#[A-Za-z_][\w.-]*|data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=\s]+)$/

const URL_OPEN = /url\s*\(/gi
const LOCAL_URL = /url\s*\(\s*(['"]?)#[A-Za-z_][\w.-]*\1\s*\)/gi

/**
 * True when a value may reference anything but a local `url(#id)`:
 * fill/filter/mask/clip-path/marker values can fetch remote resources.
 * Any CSS escape next to a parenthesis is treated as hostile.
 */
function hasForeignUrl(value: string): boolean {
  if (value.includes("\\") && value.includes("(")) return true
  const opened = value.match(URL_OPEN)?.length ?? 0
  const local = value.match(LOCAL_URL)?.length ?? 0
  return opened !== local
}

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
    const value = data.attrValue
    if (
      ((data.attrName === "href" || data.attrName === "xlink:href") &&
        !SAFE_REFERENCE.test(value.trim())) ||
      hasForeignUrl(value)
    )
      data.keepAttr = false
  })
  instance = { purify, window }
  return instance
}

/**
 * Spec §11 "SVG sanitised": DOMPurify's SVG profiles (no script, event
 * handlers, attribute animation), plus no <style> element or `style`
 * attribute (remote @import / url()), no <foreignObject>, no links, no
 * <use>; `href` only to a local `#id` or an inline raster `data:` image, and
 * any other attribute only with local `url(#id)` references. Returns one
 * well-formed <svg> element serialised as XML (image/svg+xml must parse as
 * XML).
 */
export function sanitizeSvg(source: string): string {
  const { purify, window } = purifier()
  const fragment = purify.sanitize(source, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["style", "foreignObject", "a", "use"],
    FORBID_ATTR: ["style"],
    RETURN_DOM_FRAGMENT: true,
  })
  const elements = [...fragment.children]
  if (elements.length !== 1 || elements[0].nodeName.toLowerCase() !== "svg")
    throw new SvgSanitizeError("The file is not a single SVG image")
  return new window.XMLSerializer().serializeToString(elements[0])
}
