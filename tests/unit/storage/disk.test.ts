import { existsSync } from "node:fs"
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { defaultUploadsRoot, diskStorage } from "@/server/lib/storage/disk"

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "sp-disk-"))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe("diskStorage", () => {
  const key = "2026/10/0190a6e0-0000-7000-8000-000000000001.png"

  it("writes, reads and deletes under the root", async () => {
    const disk = diskStorage(root)
    expect(disk.name).toBe("disk")
    await disk.put(key, new Uint8Array([1, 2, 3]), "image/png")
    expect(existsSync(join(root, key))).toBe(true)
    expect(await readdir(join(root, "2026/10"))).toEqual([key.split("/")[2]])
    expect([...((await disk.read(key)) ?? [])]).toEqual([1, 2, 3])
    await disk.delete(key)
    expect(await disk.read(key)).toBeNull()
    await disk.delete(key) // missing is fine
    expect(disk.url(key)).toBe(`/api/v1/media/file/${key}`)
  })

  it("refuses keys that escape the root", async () => {
    const disk = diskStorage(root)
    await expect(
      disk.put("../x.png", new Uint8Array([1]), "image/png")
    ).rejects.toThrow()
    await expect(disk.read("../../etc/passwd")).rejects.toThrow()
  })

  it("test() proves the directory is writable", async () => {
    await expect(diskStorage(root).test()).resolves.toBeUndefined()
    expect(await readdir(root)).toEqual(["healthcheck"])
  })

  it("defaults to /data/uploads only when /data exists", () => {
    expect(defaultUploadsRoot()).toBe(
      existsSync("/data")
        ? "/data/uploads"
        : join(process.cwd(), ".data/uploads")
    )
  })
})
