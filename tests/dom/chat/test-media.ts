import { vi } from "vitest"

// jsdom has no matchMedia. `reduced` answers the reduced-motion query; every
// other query (hover, pointer) answers no.
export function stubMedia(reduced: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduced && query.includes("reduce"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}
