import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { S3Client } from "@aws-sdk/client-s3"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { R2Config } from "@/lib/schemas/integrations"
import { getDb } from "@/server/db/client"
import { media } from "@/server/db/schema"
import {
  EXPORT_DUMP_ARGS,
  exportStamp,
  planUploads,
  uploadExport,
} from "@/server/lib/data-export"

import { resetDb } from "../db"

const PRESENT = "2026/10/0190a6e0-0000-7000-8000-0000000000c1.png"
const ABSENT = "2026/10/0190a6e0-0000-7000-8000-0000000000c2.png"
const r2: R2Config = {
  accountId: "0123456789abcdef0123456789abcdef",
  jurisdiction: "default",
  bucket: "shared-media",
  accessKeyId: "AKID",
  secretAccessKey: "SECRET",
  keyPrefix: "sp",
}

const ORPHAN = "2026/10/0190a6e0-0000-7000-8000-0000000000c3.webp"

let dir: string
beforeEach(async () => {
  await resetDb()
  dir = await mkdtemp(join(tmpdir(), "sp-export-it-"))
  await mkdir(join(dir, "uploads/2026/10"), { recursive: true })
  await writeFile(join(dir, "uploads", PRESENT), new Uint8Array([1, 2, 3]))
  await writeFile(join(dir, "uploads", ORPHAN), new Uint8Array([9]))
  await writeFile(join(dir, "uploads", `${ORPHAN}.0190.tmp`), "half")
  await writeFile(join(dir, "local.dump"), "PGDMP")
  await getDb()
    .insert(media)
    .values([
      { key: PRESENT, driver: "disk", mime: "image/png", size: 3 },
      { key: ABSENT, driver: "disk", mime: "image/png", size: 3 },
      {
        key: "/images/static.png",
        driver: "static",
        mime: "image/png",
        size: 1,
      },
    ])
})
afterEach(() => rm(dir, { recursive: true, force: true }))

describe("data:export-to-r2", () => {
  it("dumps with the db:sync flags (custom format, skipped tables' data left out)", () => {
    expect(EXPORT_DUMP_ARGS).toContain("--format=custom")
    expect(EXPORT_DUMP_ARGS).toContain("--exclude-table-data=public.sessions")
    expect(exportStamp(new Date("2026-10-20T09:00:00.123Z"))).toBe(
      "20261020T090000Z"
    )
  })

  it("plans the disk uploads under the folder; files missing on disk are flagged", async () => {
    const plans = await planUploads(r2, join(dir, "uploads"))
    expect(plans).toEqual([
      { key: PRESENT, mime: "image/png", objectKey: `sp/${PRESENT}`, bytes: 3 },
      {
        key: ABSENT,
        mime: "image/png",
        objectKey: `sp/${ABSENT}`,
        bytes: null,
      },
      // A file no row points at is copied too; temp files are not.
      {
        key: ORPHAN,
        mime: "image/webp",
        objectKey: `sp/${ORPHAN}`,
        bytes: 1,
        orphan: true,
      },
    ])
  })

  it("uploads files through the R2 driver keys and the dump to <folder>/bootstrap/", async () => {
    const send = vi.fn(async () => ({}))
    const plans = await planUploads(r2, join(dir, "uploads"))
    const key = await uploadExport({
      r2,
      uploadsRoot: join(dir, "uploads"),
      plans,
      dumpFile: join(dir, "local.dump"),
      stamp: "20261020T090000Z",
      client: { send } as unknown as S3Client,
    })
    expect(key).toBe("sp/bootstrap/20261020T090000Z.dump")
    const calls = (
      send.mock.calls as unknown as [
        { constructor: { name: string }; input: { Key: string } },
      ][]
    ).map(([c]) => [c.constructor.name, c.input.Key])
    expect(calls).toEqual([
      ["PutObjectCommand", `sp/${PRESENT}`],
      ["PutObjectCommand", `sp/${ORPHAN}`],
      ["PutObjectCommand", "sp/bootstrap/20261020T090000Z.dump"],
    ])
  })
})
