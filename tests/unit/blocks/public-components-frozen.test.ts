import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import FROZEN_FIXTURE from "./frozen-components.json"

// Phase D5 wraps the public section components in blocks; it never edits
// them (pD5 global constraint). Hashes of every file under components/{home,
// about,services,contact,blog} at phase start (base commit in the fixture).
const FROZEN: Record<string, string> = FROZEN_FIXTURE.files

const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex")

describe("public section components", () => {
  it("public section components are unchanged since phase start", () => {
    expect(Object.keys(FROZEN).length).toBeGreaterThan(0)
    for (const [file, sha] of Object.entries(FROZEN))
      expect(sha256(readFileSync(file)), file).toBe(sha)
  })
})
