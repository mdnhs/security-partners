import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// jsdom lacks a few browser APIs that base-ui, cmdk and ProseMirror call.
// Width queries follow window.innerWidth (tests resize by redefining it);
// anything else (prefers-*, hover …) does not match.
function matchesWidth(query: string): boolean {
  const min = /\(min-width:\s*(\d+)px\)/.exec(query)
  if (min) return window.innerWidth >= Number(min[1])
  const max = /\(max-width:\s*(\d+)px\)/.exec(query)
  if (max) return window.innerWidth <= Number(max[1])
  return false
}
if (!window.matchMedia)
  window.matchMedia = (query: string) =>
    ({
      matches: matchesWidth(query),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= NoopResizeObserver

Element.prototype.scrollIntoView ??= function scrollIntoView() {}

const noRects = () => [] as unknown as DOMRectList
Range.prototype.getClientRects ??= noRects
Range.prototype.getBoundingClientRect ??= () => new DOMRect(0, 0, 0, 0)
document.elementFromPoint ??= () => null
