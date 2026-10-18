import { inspect } from "node:util"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { parseEnv } from "@/server/env"
import { decryptSecret } from "@/server/lib/crypto"

import { resetDb } from "../db"
import {
  adminRequest,
  authPost,
  createUser,
  signIn,
  TEST_PASSWORD,
} from "../helpers/auth"

const SMTP_SENTINEL = "smtp-sentinel-password-7f3a9c"
const WRONG_PASSWORD = "wrong-password-sentinel-123"

let output: string[] = []
beforeEach(async () => {
  await resetDb()
  output = []
  for (const method of ["log", "info", "warn", "error", "debug"] as const)
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      output.push(
        args
          .map((a) => (typeof a === "string" ? a : inspect(a, { depth: 6 })))
          .join(" ")
      )
    })
})
afterEach(() => vi.restoreAllMocks())

describe("no secrets in logs (spec §13)", () => {
  it("sign-in, invites, password links, SMTP save/test and env errors log no secret", async () => {
    const owner = await createUser({ roles: ["owner"] })
    await authPost("/sign-in/email", {
      email: owner.email,
      password: WRONG_PASSWORD,
    })
    const cookie = await signIn(owner.email)

    const invite = await adminRequest("/users/invite", {
      cookie,
      method: "POST",
      json: {
        email: "log-invitee@example.test",
        name: "Log Invitee",
        roles: ["editor"],
      },
    })
    expect(invite.status).toBe(201)
    const invited = await invite.json()
    const inviteToken = new URL(invited.inviteUrl).searchParams.get("token")!

    const link = await adminRequest(`/users/${invited.user.id}/password-link`, {
      cookie,
      method: "POST",
    })
    const linkToken = new URL((await link.json()).url).searchParams.get(
      "token"
    )!

    const save = await adminRequest("/integrations/integrations.smtp", {
      cookie,
      method: "PUT",
      json: {
        version: 0,
        values: {
          host: "127.0.0.1",
          port: 1,
          secure: false,
          user: "mailer",
          password: SMTP_SENTINEL,
          fromName: "Security Partners",
          fromAddress: "no-reply@example.test",
        },
      },
    })
    expect(save.status).toBe(200)
    const test = await adminRequest("/integrations/integrations.smtp/test", {
      cookie,
      method: "POST",
    })
    expect((await test.json()).ok).toBe(false)

    await authPost("/request-password-reset", { email: owner.email })
    // sendResetPassword no longer waits for the mailer: let it finish.
    await vi.waitFor(
      () =>
        expect(output.some((line) => line.includes("reset-password"))).toBe(
          true
        ),
      { timeout: 5_000 }
    )

    expect(() =>
      parseEnv({
        DATABASE_URL: "postgres://sp:sp@127.0.0.1:5432/sp_test",
        BETTER_AUTH_SECRET: "too-short-secret-value",
        BETTER_AUTH_URL: "http://localhost:3000",
      })
    ).toThrow()
    expect(() => decryptSecret("v1:AAAA:BBBB:CCCC", "x.y")).toThrow()

    const log = output.join("\n")
    const sessionValue = cookie.split(";")[0].split("=").slice(1).join("=")
    for (const secret of [
      TEST_PASSWORD,
      WRONG_PASSWORD,
      SMTP_SENTINEL,
      process.env.BETTER_AUTH_SECRET!,
      "too-short-secret-value",
      inviteToken,
      linkToken,
      sessionValue,
    ])
      expect(
        log.includes(secret),
        `log contains a secret: ${secret.slice(0, 4)}…`
      ).toBe(false)
  })
})
