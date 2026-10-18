import { beforeAll, describe, expect, it } from "vitest"

import { app } from "@/server/api/app"

import { resetDb } from "../db"
import { signedInUser } from "../helpers/auth"

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"])
const SOME_ID = "0190a9c2-6b1e-7000-8000-000000000000"

/** Every mutating admin route the app mounts, params filled in. */
function adminMutations(): { method: string; path: string }[] {
  const seen = new Set<string>()
  const out: { method: string; path: string }[] = []
  for (const route of app.routes) {
    if (!MUTATING.has(route.method)) continue
    if (!route.path.startsWith("/api/v1/admin/")) continue
    const path = route.path
      .replace(/:[A-Za-z_]\w*(\{[^}]*\})?/g, SOME_ID)
      .replace(/\*/g, "x")
    const key = `${route.method} ${path}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ method: route.method, path })
  }
  return out
}

let cookie: string
beforeAll(async () => {
  await resetDb()
  ;({ cookie } = await signedInUser(["owner"]))
})

describe("CSRF: every mutating admin route rejects cross-origin requests (spec §13)", () => {
  const routes = adminMutations()

  it("finds the admin API's mutations", () => {
    expect(routes.length).toBeGreaterThanOrEqual(25)
  })

  it.each(routes)(
    "$method $path → 403 for a foreign Origin",
    async ({ method, path }) => {
      const res = await app.request(path, {
        method,
        headers: {
          cookie,
          origin: "https://evil.example",
          "content-type": "application/json",
        },
        body: "{}",
      })
      expect(res.status).toBe(403)
      expect((await res.json()).error.message).toBe(
        "Cross-origin request rejected"
      )
    }
  )

  it.each(routes)(
    "$method $path → 403 without Origin from another site",
    async ({ method, path }) => {
      const res = await app.request(path, {
        method,
        headers: {
          cookie,
          "sec-fetch-site": "cross-site",
          "content-type": "application/json",
        },
        body: "{}",
      })
      expect(res.status).toBe(403)
    }
  )
})
