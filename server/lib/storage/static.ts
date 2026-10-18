import "server-only"

import { resolve } from "node:path"

import { resolveInside } from "./paths"

/** Static library files ship in public/images (seed, spec §11). */
export const STATIC_PREFIX = "/images/"

/** File of a "static" media key inside public/; throws for anything else (ledger ruling). */
export function staticFilePath(
  key: string,
  publicDir: string = resolve(process.cwd(), "public")
): string {
  if (!key.startsWith(STATIC_PREFIX))
    throw new Error(
      `Static media key must start with ${STATIC_PREFIX}: "${key}"`
    )
  return resolveInside(publicDir, key.slice(1))
}
