import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import SiteError from "@/app/(site)/error"

describe("public error page (Review Focus 4)", () => {
  it("renders the site's PageHero and a retry button, never error details", () => {
    const error = Object.assign(
      new Error(
        "connect ECONNREFUSED 127.0.0.1:5432 at Pool.connect (/app/server/db/client.ts:42)"
      ),
      { digest: "123" }
    )
    const html = renderToStaticMarkup(
      <SiteError error={error} retry={() => undefined} />
    )
    expect(html).toContain("data-hero")
    expect(html).toContain("Something went wrong")
    expect(html).toContain("Try again")
    expect(html).not.toContain("ECONNREFUSED")
    expect(html).not.toContain("client.ts")
  })
})
