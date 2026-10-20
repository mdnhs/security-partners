import { like } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Which admin:create step fails in the current test.
const fail = vi.hoisted(() => ({
  step: null as null | "token" | "audit",
  cleanup: false,
}))

vi.mock("@/server/auth/tokens", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/auth/tokens")>()
  return {
    ...original,
    createPasswordToken: vi.fn(
      async (...args: Parameters<typeof original.createPasswordToken>) => {
        if (fail.step === "token") throw new Error("token store unavailable")
        return original.createPasswordToken(...args)
      }
    ),
  }
})

vi.mock("@/server/lib/audit", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/lib/audit")>()
  return {
    ...original,
    writeAudit: vi.fn(
      async (...args: Parameters<typeof original.writeAudit>) => {
        const entry = args[2]
        if (
          fail.step === "audit" &&
          (entry.diff as { via?: string } | undefined)?.via === "admin:create"
        )
          throw new Error("audit store unavailable")
        return original.writeAudit(...args)
      }
    ),
  }
})

vi.mock("@/server/modules/users/repo", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/server/modules/users/repo")>()
  return {
    ...original,
    deleteUserById: vi.fn(
      async (...args: Parameters<typeof original.deleteUserById>) => {
        if (fail.cleanup) throw new Error("cleanup failed")
        return original.deleteUserById(...args)
      }
    ),
  }
})

import { getDb } from "@/server/db/client"
import { verifications } from "@/server/db/schema"
import { createOwner } from "@/server/modules/users/bootstrap"
import { findUserByEmail } from "@/server/modules/users/repo"

import { resetDb } from "../db"

const EMAIL = "first.owner@example.test"

const passwordLinks = () =>
  getDb()
    .select()
    .from(verifications)
    .where(like(verifications.identifier, "reset-password:%"))

beforeEach(async () => {
  await resetDb()
  fail.step = null
  fail.cleanup = false
})

describe("admin:create is all-or-nothing (ledger P02-7)", () => {
  it("removes the new owner and its link when the audit step fails", async () => {
    fail.step = "audit"
    await expect(
      createOwner({ email: EMAIL, name: "First Owner" })
    ).rejects.toThrow("audit store unavailable")
    expect(await findUserByEmail(getDb(), EMAIL)).toBeNull()
    expect(await passwordLinks()).toEqual([])
  })

  it("removes the new owner when the token step itself fails", async () => {
    fail.step = "token"
    await expect(
      createOwner({ email: EMAIL, name: "First Owner" })
    ).rejects.toThrow("token store unavailable")
    expect(await findUserByEmail(getDb(), EMAIL)).toBeNull()
    expect(await passwordLinks()).toEqual([])
  })

  it("rethrows the original error when the cleanup fails too", async () => {
    fail.step = "audit"
    fail.cleanup = true
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    await expect(
      createOwner({ email: EMAIL, name: "First Owner" })
    ).rejects.toThrow("audit store unavailable")
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("could not remove the half-created owner"),
      expect.objectContaining({ message: "cleanup failed" })
    )
    log.mockRestore()
  })

  it("still creates the owner when nothing fails", async () => {
    const result = await createOwner({ email: EMAIL, name: "First Owner" })
    expect((await findUserByEmail(getDb(), EMAIL))?.id).toBe(result.userId)
    expect(await passwordLinks()).toHaveLength(1)
  })
})
