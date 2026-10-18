import { and, asc, eq } from "drizzle-orm"
import { render } from "react-email"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The users service expires cached articles on name/title changes (Phase 5);
// Hono runs outside Next here, so record instead of revalidating.
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import { getAuth } from "@/server/auth/auth"
import { getDb } from "@/server/db/client"
import { auditLog, sessions, users } from "@/server/db/schema"
import { mailer } from "@/server/lib/mailer"

import { resetDb } from "../db"
import {
  adminRequest,
  authPost,
  createUser,
  mergeCookies,
  signedInUser,
  signIn,
  TEST_PASSWORD,
} from "../helpers/auth"

const auditFor = async (action: string) =>
  getDb()
    .select()
    .from(auditLog)
    .where(eq(auditLog.action, action))
    .orderBy(asc(auditLog.createdAt))

// Any admin route answers 401 once the session is gone.
const me = (cookie: string) => adminRequest("/audit", { cookie })

beforeEach(async () => {
  await resetDb()
  vi.spyOn(console, "info").mockImplementation(() => undefined)
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe("POST /api/v1/admin/users/invite", () => {
  it("creates a passwordless user with roles and returns a working inviteUrl; emailDelivered:false without SMTP (Review Focus 3)", async () => {
    const admin = await signedInUser(["admin"])
    const res = await adminRequest("/users/invite", {
      cookie: admin.cookie,
      method: "POST",
      json: {
        email: "New.Editor@Example.test",
        name: "New Editor",
        title: "Operations Manager",
        roles: ["editor", "author", "editor"],
      },
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.emailDelivered).toBe(false)
    expect(body.user).toMatchObject({
      email: "new.editor@example.test",
      name: "New Editor",
      title: "Operations Manager",
      roles: ["editor", "author"],
      status: "invited",
    })
    const url = new URL(body.inviteUrl)
    expect(url.origin).toBe("http://localhost:3000")
    expect(url.pathname).toBe("/admin/set-password")
    const token = url.searchParams.get("token")
    expect(token).toBeTruthy()

    const [audit] = await auditFor("user.invite")
    expect(audit).toMatchObject({
      actorId: admin.user.id,
      entityId: body.user.id,
      diff: { email: "new.editor@example.test", roles: ["editor", "author"] },
    })

    // the link sets the password; the user can then sign in
    const set = await authPost("/reset-password", {
      token,
      newPassword: TEST_PASSWORD,
    })
    expect(set.status).toBe(200)
    const cookie = await signIn("new.editor@example.test")
    const self = await adminRequest(`/users/${body.user.id}`, {
      cookie: admin.cookie,
    })
    expect((await self.json()).status).toBe("active")
    expect(cookie).toContain("sp.session_token=")
  })

  it("still returns inviteUrl when the email was delivered", async () => {
    vi.spyOn(mailer, "send").mockResolvedValue({ delivered: true })
    const admin = await signedInUser(["admin"])
    const res = await adminRequest("/users/invite", {
      cookie: admin.cookie,
      method: "POST",
      json: { email: "mailed@example.test", name: "Mailed", roles: ["viewer"] },
    })
    const body = await res.json()
    expect(body.emailDelivered).toBe(true)
    expect(body.inviteUrl).toContain("/admin/set-password?token=")
    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "mailed@example.test" })
    )
  })

  it("rejects duplicates (409), bad input (422) and callers without user:invite (403)", async () => {
    const admin = await signedInUser(["admin"])
    const editor = await signedInUser(["editor"])
    const invite = (cookie: string, json: unknown) =>
      adminRequest("/users/invite", { cookie, method: "POST", json })
    const ok = { email: "dupe@example.test", name: "Dupe", roles: ["viewer"] }
    expect((await invite(admin.cookie, ok)).status).toBe(201)
    expect((await invite(admin.cookie, ok)).status).toBe(409)
    expect(
      (await invite(admin.cookie, { ...ok, email: "x@y.test", roles: [] }))
        .status
    ).toBe(422)
    expect(
      (await invite(admin.cookie, { ...ok, email: "not-an-email" })).status
    ).toBe(422)
    expect(
      (
        await invite(admin.cookie, {
          ...ok,
          email: "r@y.test",
          roles: ["root"],
        })
      ).status
    ).toBe(422)
    expect(
      (await invite(editor.cookie, { ...ok, email: "e@y.test" })).status
    ).toBe(403)
  })

  it("only owners may grant the owner role", async () => {
    const admin = await signedInUser(["admin"])
    const owner = await signedInUser(["owner"])
    const json = {
      email: "o2@example.test",
      name: "Owner Two",
      roles: ["owner"],
    }
    expect(
      (
        await adminRequest("/users/invite", {
          cookie: admin.cookie,
          method: "POST",
          json,
        })
      ).status
    ).toBe(403)
    expect(
      (
        await adminRequest("/users/invite", {
          cookie: owner.cookie,
          method: "POST",
          json,
        })
      ).status
    ).toBe(201)
  })

  it("concurrent invites for one email: exactly one 201, the others 409", async () => {
    const admin = await signedInUser(["admin"])
    const json = { email: "race@example.test", name: "Race", roles: ["viewer"] }
    const statuses = await Promise.all(
      Array.from({ length: 5 }, async () => {
        const res = await adminRequest("/users/invite", {
          cookie: admin.cookie,
          method: "POST",
          json,
        })
        return res.status
      })
    )
    expect(statuses.sort()).toEqual([201, 409, 409, 409, 409])
    expect(await auditFor("user.invite")).toHaveLength(1)
  })

  it("a lost race after the duplicate check is still 409 (Better Auth error or unique violation)", async () => {
    const admin = await signedInUser(["admin"])
    const api = getAuth().api
    const createUserOriginal = api.createUser
    const invite = (email: string) =>
      adminRequest("/users/invite", {
        cookie: admin.cookie,
        method: "POST",
        json: { email, name: "Race", roles: ["viewer"] },
      })

    // a competing request creates the user between our check and our insert
    vi.spyOn(api, "createUser").mockImplementationOnce(async (args) => {
      await createUserOriginal(args)
      return createUserOriginal(args)
    })
    const lost = await invite("race1@example.test")
    expect(lost.status).toBe(409)
    expect((await lost.json()).error.message).toBe(
      "A user with this email already exists"
    )

    // both inserts passed Better Auth's own check: users.email unique violation
    const uniqueViolation = new Error("insert failed", {
      cause: Object.assign(new Error("duplicate key"), { code: "23505" }),
    })
    vi.spyOn(api, "createUser").mockRejectedValueOnce(uniqueViolation)
    expect((await invite("race2@example.test")).status).toBe(409)
    expect(await auditFor("user.invite")).toHaveLength(0)
  })

  it("a blank title is stored as null (invite and PATCH)", async () => {
    const admin = await signedInUser(["admin"])
    const res = await adminRequest("/users/invite", {
      cookie: admin.cookie,
      method: "POST",
      json: {
        email: "t@example.test",
        name: "T",
        title: "   ",
        roles: ["viewer"],
      },
    })
    const { user } = await res.json()
    expect(user.title).toBeNull()
    expect((await auditFor("user.invite"))[0].diff).toMatchObject({
      title: null,
    })

    await adminRequest(`/users/${user.id}`, {
      cookie: admin.cookie,
      method: "PATCH",
      json: { title: "Director" },
    })
    const cleared = await adminRequest(`/users/${user.id}`, {
      cookie: admin.cookie,
      method: "PATCH",
      json: { title: "" },
    })
    expect(cleared.status).toBe(200)
    expect((await cleared.json()).title).toBeNull()
  })
})

describe("owners are special", () => {
  it("an admin cannot modify an owner (403 on every write); an owner can", async () => {
    const admin = await signedInUser(["admin"])
    const owner = await signedInUser(["owner"])
    const otherOwner = await createUser({ roles: ["owner"] })
    const id = otherOwner.id
    const writes: [string, string, unknown?][] = [
      ["PATCH", `/users/${id}`, { name: "Renamed" }],
      ["PUT", `/users/${id}/roles`, { roles: ["viewer"] }],
      ["POST", `/users/${id}/ban`, {}],
      ["DELETE", `/users/${id}/ban`],
      ["DELETE", `/users/${id}/sessions`],
      ["GET", `/users/${id}/sessions`],
      ["POST", `/users/${id}/password-link`],
      ["POST", `/users/${id}/impersonate`],
    ]
    for (const [method, path, json] of writes) {
      const res = await adminRequest(path, {
        cookie: admin.cookie,
        method,
        json,
      })
      expect([method, path, res.status]).toEqual([method, path, 403])
    }
    // admin cannot promote anyone to owner either
    const editor = await createUser({ roles: ["editor"] })
    const promote = await adminRequest(`/users/${editor.id}/roles`, {
      cookie: admin.cookie,
      method: "PUT",
      json: { roles: ["owner"] },
    })
    expect(promote.status).toBe(403)

    const ownerEdit = await adminRequest(`/users/${id}`, {
      cookie: owner.cookie,
      method: "PATCH",
      json: { title: "Director" },
    })
    expect(ownerEdit.status).toBe(200)
    expect((await ownerEdit.json()).title).toBe("Director")
  })

  it("the last active owner cannot be demoted or banned (409); with a second owner they can", async () => {
    const owner = await signedInUser(["owner"])
    const demoteSelf = () =>
      adminRequest(`/users/${owner.user.id}/roles`, {
        cookie: owner.cookie,
        method: "PUT",
        json: { roles: ["admin"] },
      })
    const demote = await demoteSelf()
    expect(demote.status).toBe(409)
    expect((await demote.json()).error.message).toBe(
      "The last active owner cannot be demoted"
    )
    const ban = await adminRequest(`/users/${owner.user.id}/ban`, {
      cookie: owner.cookie,
      method: "POST",
      json: {},
    })
    expect(ban.status).toBe(409)
    expect((await ban.json()).error.message).toBe(
      "The last active owner cannot be banned"
    )

    // a banned second owner does not count as active
    const banned = await createUser({ roles: ["owner"] })
    await getDb()
      .update(users)
      .set({ banned: true })
      .where(eq(users.id, banned.id))
    expect((await demoteSelf()).status).toBe(409)

    // neither does an invited owner who never chose a password
    await createUser({ roles: ["owner"], password: null })
    expect((await demoteSelf()).status).toBe(409)
    const banWithInvitedOwner = await adminRequest(
      `/users/${owner.user.id}/ban`,
      { cookie: owner.cookie, method: "POST", json: {} }
    )
    expect(banWithInvitedOwner.status).toBe(409)
    expect((await banWithInvitedOwner.json()).error.message).toBe(
      "The last active owner cannot be banned"
    )

    await createUser({ roles: ["owner", "editor"] })
    const ok = await demoteSelf()
    expect(ok.status).toBe(200)
    expect((await ok.json()).roles).toEqual(["admin"])
  })
})

describe("roles, ban, sessions", () => {
  it("role change is audited with from/to and applies on the next request", async () => {
    const admin = await signedInUser(["admin"])
    const target = await signedInUser(["viewer"])
    expect(
      (await adminRequest("/audit", { cookie: target.cookie })).status
    ).toBe(403)
    const res = await adminRequest(`/users/${target.user.id}/roles`, {
      cookie: admin.cookie,
      method: "PUT",
      json: { roles: ["admin"] },
    })
    expect(res.status).toBe(200)
    expect((await auditFor("user.roles_change"))[0].diff).toEqual({
      from: ["viewer"],
      to: ["admin"],
    })
    expect(
      (await adminRequest("/audit", { cookie: target.cookie })).status
    ).toBe(200)
  })

  it("ban revokes sessions, blocks sign-in and is audited; unban restores access", async () => {
    const admin = await signedInUser(["admin"])
    const target = await signedInUser(["editor"])
    const ban = await adminRequest(`/users/${target.user.id}/ban`, {
      cookie: admin.cookie,
      method: "POST",
      json: { reason: "Left the company", expiresInDays: 30 },
    })
    expect(ban.status).toBe(200)
    const banned = await ban.json()
    expect(banned.status).toBe("banned")
    expect(banned.banReason).toBe("Left the company")
    expect(Date.parse(banned.banExpires) - Date.now()).toBeGreaterThan(
      29 * 86_400_000
    )
    expect(
      await getDb()
        .select()
        .from(sessions)
        .where(eq(sessions.userId, target.user.id))
    ).toEqual([])
    expect((await me(target.cookie)).status).toBe(401)

    const signInAgain = await authPost("/sign-in/email", {
      email: target.user.email,
      password: TEST_PASSWORD,
    })
    expect(signInAgain.status).toBe(403)
    expect((await signInAgain.json()).code).toBe("BANNED_USER")
    expect((await auditFor("user.ban"))[0]).toMatchObject({
      actorId: admin.user.id,
      entityId: target.user.id,
      diff: { reason: "Left the company", sessionsRevoked: 1 },
    })

    const unban = await adminRequest(`/users/${target.user.id}/ban`, {
      cookie: admin.cookie,
      method: "DELETE",
    })
    expect(unban.status).toBe(200)
    expect((await unban.json()).status).toBe("active")
    expect(await auditFor("user.unban")).toHaveLength(1)
    await signIn(target.user.email)
  })

  it("cannot ban yourself", async () => {
    const admin = await signedInUser(["admin"])
    const res = await adminRequest(`/users/${admin.user.id}/ban`, {
      cookie: admin.cookie,
      method: "POST",
      json: {},
    })
    expect(res.status).toBe(409)
  })

  it("lists and revokes a user's sessions (audited)", async () => {
    const admin = await signedInUser(["admin"])
    const target = await createUser({ roles: ["viewer"] })
    const a = await signIn(target.email)
    await signIn(target.email)
    const list = await adminRequest(`/users/${target.id}/sessions`, {
      cookie: admin.cookie,
    })
    expect((await list.json()).items).toHaveLength(2)
    const revoke = await adminRequest(`/users/${target.id}/sessions`, {
      cookie: admin.cookie,
      method: "DELETE",
    })
    expect(await revoke.json()).toEqual({ revoked: 2 })
    expect((await me(a)).status).toBe(401)
    expect((await auditFor("user.sessions_revoke"))[0].diff).toEqual({
      revoked: 2,
    })
  })

  it("password-link returns a set-password link for invited users and reset-password otherwise", async () => {
    const admin = await signedInUser(["admin"])
    const invited = await createUser({ roles: ["viewer"], password: null })
    const active = await createUser({ roles: ["viewer"] })
    const link = async (id: string) =>
      (
        await adminRequest(`/users/${id}/password-link`, {
          cookie: admin.cookie,
          method: "POST",
        })
      ).json()
    expect((await link(invited.id)).url).toContain("/admin/set-password?token=")
    const second = await link(active.id)
    expect(second.url).toContain("/admin/reset-password?token=")
    expect(second.emailDelivered).toBe(false)
    expect(await auditFor("user.password_link")).toHaveLength(2)
  })

  it("password-link emails invite wording to invited users and reset wording otherwise, expiry in hours", async () => {
    const send = vi.spyOn(mailer, "send")
    const admin = await signedInUser(["admin"])
    const invited = await createUser({ roles: ["viewer"], password: null })
    const active = await createUser({ roles: ["viewer"] })
    for (const id of [invited.id, active.id])
      await adminRequest(`/users/${id}/password-link`, {
        cookie: admin.cookie,
        method: "POST",
      })
    const [toInvited, toActive] = send.mock.calls.map(([msg]) => msg)
    expect(toInvited.to).toBe(invited.email)
    const invitedText = await render(toInvited.react, { plainText: true })
    expect(invitedText).toContain("invited you")
    expect(invitedText).not.toContain("reset the password")
    expect(invitedText).toContain("expires in 24 hours")
    expect(toActive.to).toBe(active.email)
    const activeText = await render(toActive.react, { plainText: true })
    expect(activeText).toContain("reset the password")
    expect(activeText).toContain("expires in 24 hours")
  })

  it("a new password-link revokes the user's earlier links", async () => {
    const admin = await signedInUser(["admin"])
    const target = await createUser({ roles: ["viewer"] })
    const link = async () => {
      const res = await adminRequest(`/users/${target.id}/password-link`, {
        cookie: admin.cookie,
        method: "POST",
      })
      return new URL((await res.json()).url).searchParams.get("token")
    }
    const first = await link()
    const second = await link()
    const reset = (token: string | null) =>
      authPost("/reset-password", { token, newPassword: TEST_PASSWORD })
    expect((await reset(first)).status).toBe(400)
    expect((await reset(second)).status).toBe(200)
    expect((await auditFor("user.password_link"))[1].diff).toEqual({
      passwordLinksRevoked: 1,
    })
  })

  it("lists users with status and role filters", async () => {
    const admin = await signedInUser(["admin"])
    await createUser({ roles: ["editor"], name: "Eddie Editor" })
    await createUser({ roles: ["viewer"], password: null })
    const list = async (q: string) =>
      (await adminRequest(`/users${q}`, { cookie: admin.cookie })).json()
    expect((await list("")).total).toBe(3)
    expect((await list("?status=invited")).total).toBe(1)
    expect((await list("?status=active")).total).toBe(2)
    expect(
      (await list("?role=editor")).items.map((u: { name: string }) => u.name)
    ).toEqual(["Eddie Editor"])
    expect((await list("?q=eddie")).total).toBe(1)
    expect((await list("?sort=name:asc&pageSize=2")).items).toHaveLength(2)
  })
})

describe("impersonation", () => {
  it("admin impersonates an editor for 1 hour, audited; stop restores the admin", async () => {
    const admin = await signedInUser(["admin"])
    const editor = await createUser({ roles: ["editor"] })
    const start = await adminRequest(`/users/${editor.id}/impersonate`, {
      cookie: admin.cookie,
      method: "POST",
    })
    expect(start.status).toBe(200)
    const body = await start.json()
    expect(body.user.id).toBe(editor.id)
    const hours = (Date.parse(body.expiresAt) - Date.now()) / 3_600_000
    expect(hours).toBeGreaterThan(0.98)
    expect(hours).toBeLessThanOrEqual(1)

    const asEditor = mergeCookies(admin.cookie, start)
    const [row] = await getDb()
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, editor.id),
          eq(sessions.impersonatedBy, admin.user.id)
        )
      )
    expect(row).toBeDefined()
    // acting as the editor: no audit:read
    expect((await adminRequest("/audit", { cookie: asEditor })).status).toBe(
      403
    )
    expect((await auditFor("user.impersonate_start"))[0]).toMatchObject({
      actorId: admin.user.id,
      entityId: editor.id,
    })

    const stop = await adminRequest("/users/stop-impersonating", {
      cookie: asEditor,
      method: "POST",
    })
    expect(stop.status).toBe(200)
    const back = mergeCookies(asEditor, stop)
    expect((await adminRequest("/audit", { cookie: back })).status).toBe(200)
    expect((await auditFor("user.impersonate_stop"))[0]).toMatchObject({
      actorId: admin.user.id,
      entityId: editor.id,
    })
  })

  it("cannot impersonate an owner unless owner; never yourself; stop needs an impersonation", async () => {
    const admin = await signedInUser(["admin"])
    const owner = await signedInUser(["owner"])
    const target = await createUser({ roles: ["owner"] })
    const impersonate = (cookie: string, id: string) =>
      adminRequest(`/users/${id}/impersonate`, { cookie, method: "POST" })
    expect((await impersonate(admin.cookie, target.id)).status).toBe(403)
    expect((await impersonate(owner.cookie, target.id)).status).toBe(200)
    expect((await impersonate(admin.cookie, admin.user.id)).status).toBe(422)
    const stop = await adminRequest("/users/stop-impersonating", {
      cookie: admin.cookie,
      method: "POST",
    })
    expect(stop.status).toBe(409)
  })
})

describe("credentials do not outlive the privilege that issued them", () => {
  const impersonate = async (cookie: string, id: string) => {
    const res = await adminRequest(`/users/${id}/impersonate`, {
      cookie,
      method: "POST",
    })
    expect(res.status).toBe(200)
    return mergeCookies(cookie, res)
  }

  it("promotion to owner revokes earlier password links and impersonation sessions of the user", async () => {
    const admin = await signedInUser(["admin"])
    const owner = await signedInUser(["owner"])
    const res = await adminRequest("/users/invite", {
      cookie: admin.cookie,
      method: "POST",
      json: { email: "x@example.test", name: "X", roles: ["editor"] },
    })
    const invite = await res.json()
    const token = new URL(invite.inviteUrl).searchParams.get("token")
    const asX = await impersonate(admin.cookie, invite.user.id)
    // signed in as the editor (403, not 401)
    expect((await me(asX)).status).toBe(403)

    const promote = await adminRequest(`/users/${invite.user.id}/roles`, {
      cookie: owner.cookie,
      method: "PUT",
      json: { roles: ["owner"] },
    })
    expect(promote.status).toBe(200)
    expect((await me(asX)).status).toBe(401)
    expect((await me(admin.cookie)).status).toBe(200)
    const set = await authPost("/reset-password", {
      token,
      newPassword: TEST_PASSWORD,
    })
    expect(set.status).toBe(400)
    expect((await auditFor("user.roles_change"))[0].diff).toEqual({
      from: ["editor"],
      to: ["owner"],
      passwordLinksRevoked: 1,
      impersonationsRevoked: 1,
      sessionsRevoked: 0,
    })
  })

  it("banning the impersonator ends their impersonation sessions", async () => {
    const owner = await signedInUser(["owner"])
    const admin = await signedInUser(["admin"])
    const x = await createUser({ roles: ["editor"] })
    const asX = await impersonate(admin.cookie, x.id)
    expect((await me(asX)).status).toBe(403)
    const ban = await adminRequest(`/users/${admin.user.id}/ban`, {
      cookie: owner.cookie,
      method: "POST",
      json: {},
    })
    expect(ban.status).toBe(200)
    expect((await me(asX)).status).toBe(401)
    expect((await auditFor("user.ban"))[0].diff).toMatchObject({
      sessionsRevoked: 2,
    })
  })

  it("revoking the impersonator's sessions ends their impersonation sessions", async () => {
    const owner = await signedInUser(["owner"])
    const admin = await signedInUser(["admin"])
    const x = await createUser({ roles: ["editor"] })
    const asX = await impersonate(admin.cookie, x.id)
    const revoke = await adminRequest(`/users/${admin.user.id}/sessions`, {
      cookie: owner.cookie,
      method: "DELETE",
    })
    expect(await revoke.json()).toEqual({ revoked: 2 })
    expect((await me(asX)).status).toBe(401)
  })

  it("losing user:impersonate signs the user out, impersonations included; keeping it does not", async () => {
    const owner = await signedInUser(["owner"])
    const admin = await signedInUser(["admin"])
    const x = await createUser({ roles: ["editor"] })
    const asX = await impersonate(admin.cookie, x.id)

    const setRoles = (roles: string[]) =>
      adminRequest(`/users/${admin.user.id}/roles`, {
        cookie: owner.cookie,
        method: "PUT",
        json: { roles },
      })
    expect((await setRoles(["admin", "editor"])).status).toBe(200)
    expect((await me(asX)).status).toBe(403)

    expect((await setRoles(["editor"])).status).toBe(200)
    expect((await me(asX)).status).toBe(401)
    expect((await me(admin.cookie)).status).toBe(401)
    const [, demoted] = await auditFor("user.roles_change")
    expect(demoted.diff).toEqual({
      from: ["admin", "editor"],
      to: ["editor"],
      sessionsRevoked: 2,
    })
  })
})
