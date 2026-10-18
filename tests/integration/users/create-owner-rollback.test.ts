import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/server/lib/audit", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/lib/audit")>()
  return {
    ...original,
    writeAudit: vi.fn(
      async (...args: Parameters<typeof original.writeAudit>) => {
        const entry = args[2]
        if (
          (entry.diff as { via?: string } | undefined)?.via === "admin:create"
        )
          throw new Error("audit store unavailable")
        return original.writeAudit(...args)
      }
    ),
  }
})

import { getDb } from "@/server/db/client"
import { createOwner } from "@/server/modules/users/bootstrap"
import { findUserByEmail } from "@/server/modules/users/repo"

import { resetDb } from "../db"

beforeEach(resetDb)

describe("admin:create is all-or-nothing (ledger P02-7)", () => {
  it("removes the new owner again when a later step fails", async () => {
    await expect(
      createOwner({ email: "first.owner@example.test", name: "First Owner" })
    ).rejects.toThrow("audit store unavailable")
    expect(
      await findUserByEmail(getDb(), "first.owner@example.test")
    ).toBeNull()
  })
})
