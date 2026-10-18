import "server-only"

import { randomUUID } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

import { mediaFileUrl, resolveInside } from "./paths"
import type { StorageDriver } from "./types"

/** The Docker volume (Dockerfile creates /data, docker-compose mounts it). */
export const DATA_DIR = "/data"

/**
 * Upload directory: /data/uploads in the container, .data/uploads in a
 * checkout (gitignored). Decided by the volume, not NODE_ENV: E2E and
 * visual runs use `next start` (production) on a laptop.
 */
export function defaultUploadsRoot(): string {
  return existsSync(DATA_DIR)
    ? `${DATA_DIR}/uploads`
    : resolve(process.cwd(), ".data/uploads")
}

export function diskStorage(
  root: string = defaultUploadsRoot()
): StorageDriver {
  return {
    name: "disk",
    async put(key, body) {
      const path = resolveInside(root, key)
      await mkdir(dirname(path), { recursive: true })
      // Write then rename: the file route never sees a half-written file.
      const temp = `${path}.${randomUUID()}.tmp`
      try {
        await writeFile(temp, body)
        await rename(temp, path)
      } catch (err) {
        await rm(temp, { force: true })
        throw err
      }
    },
    async read(key) {
      try {
        return new Uint8Array(await readFile(resolveInside(root, key)))
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null
        throw err
      }
    },
    async delete(key) {
      await rm(resolveInside(root, key), { force: true })
    },
    url: mediaFileUrl,
    async test() {
      const key = `healthcheck/${randomUUID()}.txt`
      await this.put(key, new TextEncoder().encode("ok"), "text/plain")
      await this.delete(key)
    },
  }
}
