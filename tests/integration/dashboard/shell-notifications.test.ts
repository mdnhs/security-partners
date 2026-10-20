import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import { jobs, settings } from "@/server/db/schema"
import type { Actor } from "@/server/lib/actor"
import { getShellNotifications } from "@/server/modules/dashboard/service"

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

describe("topbar bell (final review I6)", () => {
  it("is empty when nothing needs attention", async () => {
    const owner = await createUser({ roles: ["owner"] })
    expect(
      await getShellNotifications(actorOf(owner.id, ["owner"]), 0)
    ).toEqual([])
  })

  it("lists new leads, the spam-protection warning and failed jobs for those allowed", async () => {
    const owner = await createUser({ roles: ["owner"] })
    const intake = await createUser({ roles: ["intake"] })
    const editor = await createUser({ roles: ["editor"] })
    await getDb().insert(jobs).values({
      name: "backup",
      key: "backup",
      runAt: new Date(),
      lastError: "pg_dump exited with code 1",
    })
    // A Turnstile secret that no longer decrypts (changed BETTER_AUTH_SECRET).
    await getDb()
      .insert(settings)
      .values({
        key: "integrations.turnstile",
        draft: {
          enabled: true,
          siteKey: "0x4AAA",
          secretKey: "v1:not:a:secret",
        },
        published: null,
        version: 1,
      })

    const forOwner = await getShellNotifications(
      actorOf(owner.id, ["owner"]),
      2
    )
    expect(forOwner.map((item) => item.id)).toEqual([
      "turnstile-unreadable",
      "new-leads",
      "failed-jobs",
    ])
    expect(forOwner[1]).toMatchObject({
      title: "2 new enquiries",
      href: "/admin/leads?status=new&assignee=none",
    })
    expect(forOwner[2]).toMatchObject({
      description: "backup",
      href: "/admin/settings/integrations",
    })

    // Lead handlers see the leads only; editors see nothing.
    expect(
      (await getShellNotifications(actorOf(intake.id, ["intake"]), 1)).map(
        (item) => item.title
      )
    ).toEqual(["1 new enquiry"])
    expect(
      await getShellNotifications(actorOf(editor.id, ["editor"]), null)
    ).toEqual([])
  })
})
