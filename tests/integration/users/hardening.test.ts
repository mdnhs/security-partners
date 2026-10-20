import { and, eq, like } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import { auditLog, sessions, users, verifications } from "@/server/db/schema"
import type { Actor } from "@/server/lib/actor"
import {
  removeDemoUsers,
  seedDemoUsers,
} from "@/server/modules/users/bootstrap"
import {
  createPasswordLink,
  setRoles,
  unbanUser,
} from "@/server/modules/users/service"

import { resetDb } from "../db"
import { createUser, signIn } from "../helpers/auth"

const actor = (userId: string, roles: Actor["roles"]): Actor => ({
  userId,
  roles,
  ip: null,
  userAgent: null,
  impersonatorId: null,
})
const DEMO_PASSWORD = "demo-password-0123456789"

beforeEach(resetDb)

describe("users hardening (Phase 10 sweep)", () => {
  it("a new password link replaces older ones atomically and is audited", async () => {
    const owner = await createUser({ roles: ["owner"] })
    const target = await createUser({ roles: ["editor"] })
    const first = await createPasswordLink(
      actor(owner.id, ["owner"]),
      target.id
    )
    const second = await createPasswordLink(
      actor(owner.id, ["owner"]),
      target.id
    )
    expect(first.url).not.toBe(second.url)
    const rows = await getDb()
      .select()
      .from(verifications)
      .where(
        and(
          like(verifications.identifier, "reset-password:%"),
          eq(verifications.value, target.id)
        )
      )
    expect(rows.map((r) => r.identifier)).toEqual([
      `reset-password:${new URL(second.url).searchParams.get("token")}`,
    ])
    const audit = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "user.password_link"))
    expect(audit).toHaveLength(2)
  })

  it("promotion to owner signs the target out everywhere", async () => {
    const owner = await createUser({ roles: ["owner"] })
    const target = await createUser({ roles: ["admin"] })
    await signIn(target.email)
    await setRoles(actor(owner.id, ["owner"]), target.id, { roles: ["owner"] })
    expect(
      await getDb()
        .select()
        .from(sessions)
        .where(eq(sessions.userId, target.id))
    ).toHaveLength(0)
    const [row] = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "user.roles_change"))
    expect(row.diff).toMatchObject({ sessionsRevoked: 1 })
  })

  it("unbanning a user who is not banned changes and audits nothing", async () => {
    const owner = await createUser({ roles: ["owner"] })
    const target = await createUser({ roles: ["editor"] })
    const item = await unbanUser(actor(owner.id, ["owner"]), target.id)
    expect(item.id).toBe(target.id)
    expect(
      await getDb()
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, "user.unban"))
    ).toHaveLength(0)
  })

  it("demo seeding is audited; demo:remove refuses to leave no real owner", async () => {
    await seedDemoUsers(DEMO_PASSWORD)
    const seeded = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "user.demo_seeded"))
    expect(seeded).toHaveLength(1)
    expect((seeded[0].diff as { emails: string[] }).emails).toHaveLength(7)

    await expect(removeDemoUsers()).rejects.toThrow(
      "Create a real owner first, or finish setting its password."
    )
    expect(
      await getDb()
        .select()
        .from(users)
        .where(like(users.email, "%@demo.local"))
    ).toHaveLength(7)

    await createUser({ roles: ["owner"], email: "real.owner@example.test" })
    const { removed } = await removeDemoUsers()
    expect(removed).toHaveLength(7)
    expect(
      await getDb()
        .select()
        .from(users)
        .where(like(users.email, "%@demo.local"))
    ).toHaveLength(0)
    expect(
      await getDb()
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, "user.demo_removed"))
    ).toHaveLength(1)
  })

  it("demo:remove deletes only the seeded <role>@demo.local accounts", async () => {
    await seedDemoUsers(DEMO_PASSWORD)
    await createUser({ roles: ["owner"], email: "real.owner@example.test" })
    const other = await createUser({
      roles: ["editor"],
      email: "other@demo.local",
      password: null,
    })
    const { removed } = await removeDemoUsers()
    expect(removed).toHaveLength(7)
    expect(removed).not.toContain("other@demo.local")
    expect(
      await getDb()
        .select({ id: users.id })
        .from(users)
        .where(like(users.email, "%@demo.local"))
    ).toEqual([{ id: other.id }])
  })

  it("names both inputs in the demo password length error", async () => {
    await expect(seedDemoUsers("short")).rejects.toThrow(
      "--password (or DEMO_PASSWORD) must be 12–128 characters"
    )
  })
})
