import { renderToString } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

// The theme read never settles here: the static shell is the fallback, as
// in a prerender where the dynamic theme is a hole.
vi.mock("@/components/admin/theme/admin-theme-style", () => ({
  AdminThemeStyle: () => {
    throw new Promise(() => {})
  },
}))

import { AdminThemed } from "@/components/admin/theme/admin-themed"

const form = (
  <form method="post" aria-label="Forgot password">
    <button type="submit">Send reset link</button>
  </form>
)

describe("AdminThemed static shell (no JavaScript)", () => {
  it("noscript: the content is in the shell inside <noscript>", () => {
    const html = renderToString(<AdminThemed noscript>{form}</AdminThemed>)
    expect(html).toMatch(/<noscript>.*Send reset link.*<\/noscript>/s)
  })

  it("default: nothing in the shell (the panel streams its own skeleton)", () => {
    const html = renderToString(<AdminThemed>{form}</AdminThemed>)
    expect(html).not.toContain("Send reset link")
    expect(html).not.toContain("<noscript>")
  })
})
