import { describe, expect, it } from "vitest"

import { clientSchema } from "@/lib/schemas/content/client"

const client = {
  name: "Dinn Rí",
  logo: { mediaId: "0199a0b2-4c1d-7e3f-8a5b-0123456789ab" },
  url: null as string | null,
}

describe("clientSchema.url", () => {
  it.each([null, "https://www.dinnri.ie"])("accepts %j", (url) => {
    expect(clientSchema.safeParse({ ...client, url }).success).toBe(true)
  })

  it.each(["javascript:alert(1)", "data:text/html,x"])("rejects %j", (url) => {
    expect(clientSchema.safeParse({ ...client, url }).success).toBe(false)
  })
})
