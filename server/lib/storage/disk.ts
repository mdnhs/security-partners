import "server-only"

import { randomUUID } from "node:crypto"
import { existsSync } from "node:fs"
import {
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import { dirname, resolve, sep } from "node:path"
import { Readable } from "node:stream"

import { mediaFileUrl, resolveInside } from "./paths"
import type { ByteRange, StorageDriver, StoredStream } from "./types"

/** The Docker volume (Dockerfile creates /data, docker-compose mounts it). */
export const DATA_DIR = "/data"

/**
 * Upload directory: /data/uploads in the container, .data/uploads in a
 * checkout (gitignored). Decided by the volume, not NODE_ENV: E2E and
 * visual runs use `next start` (production) on a laptop.
 *
 * Phase 10 docs: if /data exists but is read-only (volume mounted `:ro` or
 * owned by another user), uploads fail with the filesystem error (EROFS /
 * EACCES); nothing falls back to .data. A crash between write and rename
 * can leave `<key>.<uuid>.tmp` files next to uploads: no media row points at
 * them, so they are never served, and they can be deleted by hand.
 */
export function defaultUploadsRoot(): string {
  return existsSync(DATA_DIR)
    ? `${DATA_DIR}/uploads`
    : resolve(process.cwd(), ".data/uploads")
}

const errno = (err: unknown) => (err as NodeJS.ErrnoException).code

/** True when the real path of `path` (symlinks followed) is `root` or inside it. */
async function realInside(realRoot: string, path: string): Promise<boolean> {
  const real = await realpath(path)
  return real === realRoot || real.startsWith(realRoot + sep)
}

/** Deepest existing ancestor of `dir` (itself included). */
async function existingAncestor(dir: string): Promise<string> {
  for (let d = dir; ; d = dirname(d)) {
    try {
      await realpath(d)
      return d
    } catch (err) {
      if (errno(err) !== "ENOENT" || dirname(d) === d) throw err
    }
  }
}

const outside = (key: string) =>
  new Error(`Media key "${key}" leaves the uploads directory`)

export function diskStorage(
  root: string = defaultUploadsRoot()
): StorageDriver {
  const base = resolve(root)

  async function put(key: string, body: Uint8Array): Promise<void> {
    const path = resolveInside(base, key)
    await mkdir(base, { recursive: true })
    const realRoot = await realpath(base)
    // A symlinked directory below the root must not lead mkdir/write outside.
    if (!(await realInside(realRoot, await existingAncestor(dirname(path)))))
      throw outside(key)
    await mkdir(dirname(path), { recursive: true })
    if (!(await realInside(realRoot, dirname(path)))) throw outside(key)
    // Write then rename: the file route never sees a half-written file.
    const temp = `${path}.${randomUUID()}.tmp`
    try {
      await writeFile(temp, body)
      await rename(temp, path)
    } catch (err) {
      await rm(temp, { force: true })
      throw err
    }
  }

  async function read(key: string): Promise<Uint8Array | null> {
    const path = resolveInside(base, key)
    try {
      // The file itself may be a symlink: follow it and check where it lands.
      if (!(await realInside(await realpath(base), path))) return null
      return new Uint8Array(await readFile(path))
    } catch (err) {
      const code = errno(err)
      if (code === "ENOENT" || code === "EISDIR" || code === "ENOTDIR")
        return null
      throw err
    }
  }

  async function stream(
    key: string,
    range?: ByteRange
  ): Promise<StoredStream | null> {
    const path = resolveInside(base, key)
    try {
      // Same symlink rule as read(); the open handle then pins the file.
      if (!(await realInside(await realpath(base), path))) return null
      const handle = await open(path, "r")
      try {
        const stats = await handle.stat()
        if (!stats.isFile()) {
          await handle.close()
          return null
        }
        // The size comes from the path: under `next dev` an open handle's
        // fstat can report size 0 (blocks right), which served every file
        // as an empty body. Keys are immutable, so both name one file.
        const { size } = await stat(path)
        // The stream owns the handle from here (autoClose).
        const nodeStream = handle.createReadStream(
          range ? { start: range.start, end: range.end } : {}
        )
        return {
          body: Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>,
          size,
          partial: range !== undefined,
        }
      } catch (err) {
        await handle.close().catch(() => {})
        throw err
      }
    } catch (err) {
      const code = errno(err)
      if (code === "ENOENT" || code === "EISDIR" || code === "ENOTDIR")
        return null
      throw err
    }
  }

  async function remove(key: string): Promise<void> {
    const path = resolveInside(base, key)
    try {
      if (!(await realInside(await realpath(base), dirname(path))))
        throw outside(key)
    } catch (err) {
      const code = errno(err)
      if (code === "ENOENT" || code === "ENOTDIR") return // nothing to delete
      throw err
    }
    // rm removes a symlinked file itself, never its target.
    await rm(path, { force: true })
  }

  return {
    name: "disk",
    put,
    read,
    stream,
    delete: remove,
    url: mediaFileUrl,
    async test() {
      // Top-level key: the check leaves no directory behind.
      const key = `healthcheck-${randomUUID()}.txt`
      await put(key, new TextEncoder().encode("ok"))
      await remove(key)
    },
  }
}
