import { existsSync } from "node:fs"
import {
  mkdir,
  mkdtemp,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises"
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
    expect(await readdir(root)).toEqual([])
  })

  it("reads a directory or a path through a file as missing", async () => {
    const disk = diskStorage(root)
    await mkdir(join(root, key), { recursive: true })
    expect(await disk.read(key)).toBeNull() // EISDIR
    await writeFile(join(root, "2027"), "x")
    expect(await disk.read("2027/01/a.png")).toBeNull() // ENOTDIR
  })

  describe("symlinks never lead outside the root", () => {
    let outside: string
    beforeEach(async () => {
      outside = await mkdtemp(join(tmpdir(), "sp-outside-"))
      await mkdir(join(outside, "10"))
      await writeFile(join(outside, "10", key.split("/")[2]), "secret")
      await writeFile(join(outside, "secret.png"), "secret")
      await symlink(outside, join(root, "2026")) // year dir → outside
    })
    afterEach(async () => {
      await rm(outside, { recursive: true, force: true })
    })

    it("refuses to write, read or delete through a symlinked directory", async () => {
      const disk = diskStorage(root)
      const other = "2026/10/0190a6e0-0000-7000-8000-000000000002.png"
      await expect(
        disk.put(other, new Uint8Array([1]), "image/png")
      ).rejects.toThrow(/leaves the uploads directory/)
      await expect(
        disk.put("2026/11/x.png", new Uint8Array([1]), "image/png")
      ).rejects.toThrow(/leaves the uploads directory/)
      expect((await readdir(outside)).sort()).toEqual(["10", "secret.png"])
      expect(await readdir(join(outside, "10"))).toEqual([key.split("/")[2]])
      expect(await disk.read(key)).toBeNull()
      await expect(disk.delete(key)).rejects.toThrow(
        /leaves the uploads directory/
      )
      expect(existsSync(join(outside, "10", key.split("/")[2]))).toBe(true)
    })

    it("does not follow a symlinked file outside the root", async () => {
      await mkdir(join(root, "2025/01"), { recursive: true })
      await symlink(join(outside, "secret.png"), join(root, "2025/01/link.png"))
      const disk = diskStorage(root)
      expect(await disk.read("2025/01/link.png")).toBeNull()
      await disk.delete("2025/01/link.png") // removes the link only
      expect(existsSync(join(outside, "secret.png"))).toBe(true)
    })
  })

  it("defaults to /data/uploads only when /data exists", () => {
    expect(defaultUploadsRoot()).toBe(
      existsSync("/data")
        ? "/data/uploads"
        : join(process.cwd(), ".data/uploads")
    )
  })
})
