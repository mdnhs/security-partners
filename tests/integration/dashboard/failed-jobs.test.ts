import { beforeEach, describe, expect, it, vi } from "vitest"

// Not under test here: the cached SEO health / QA readers (they need Next's
// cache scope and, for SEO, seeded settings).
vi.mock("@/server/modules/dashboard/content-review", () => ({
  cachedSeoHealth: async () => ({
    score: 100,
    passed: 0,
    total: 0,
    entities: [],
    issues: [],
    alt: { images: 0, described: 0, decorative: 0, missing: 0 },
  }),
  cachedQa: async () => [],
}))

import { getDb } from "@/server/db/client"
import { jobs } from "@/server/db/schema"
import type { Actor } from "@/server/lib/actor"
import { getDashboard } from "@/server/modules/dashboard/service"

import { resetDb } from "../db"
import { createUser } from "../helpers/auth"

const actorOf = (userId: string, roles: Actor["roles"]): Actor => ({
  userId,
  roles,
  ip: null,
  userAgent: null,
  impersonatorId: null,
})

beforeEach(resetDb)

describe("dashboard Next up: failed background jobs (spec §12)", () => {
  it("lists failing jobs for owners/admins only, and nothing when all are fine", async () => {
    const owner = await createUser({ roles: ["owner"] })
    const editor = await createUser({ roles: ["editor"] })
    const ownerActor = actorOf(owner.id, ["owner"])
    expect(
      (await getDashboard(ownerActor)).nextUp.find(
        (i) => i.id === "failed-jobs"
      )
    ).toBeUndefined()

    await getDb().insert(jobs).values({
      name: "backup",
      key: "backup",
      runAt: new Date(),
      lastError: "pg_dump exited with code 1: connection refused",
    })
    const item = (await getDashboard(ownerActor)).nextUp.find(
      (i) => i.id === "failed-jobs"
    )
    expect(item).toMatchObject({
      title: "Background jobs need attention",
      href: "/admin/settings/integrations",
      done: false,
    })
    expect(item?.description).toContain("backup: pg_dump exited with code 1")
    expect(
      (await getDashboard(actorOf(editor.id, ["editor"]))).nextUp.find(
        (i) => i.id === "failed-jobs"
      )
    ).toBeUndefined()
  })
})
