// Copies public/ and .next/static/ next to .next/standalone/server.js — what
// the Dockerfile does — so Playwright tests the server production runs.
//   node scripts/prepare-standalone.mjs   (after `pnpm build`)
import { cpSync, existsSync, rmSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const standalone = resolve(root, ".next/standalone")
if (!existsSync(resolve(standalone, "server.js"))) {
  console.error(
    "[prepare-standalone] .next/standalone/server.js missing: run `pnpm build` first"
  )
  process.exit(1)
}
for (const dir of ["public", ".next/static"]) {
  rmSync(resolve(standalone, dir), { recursive: true, force: true })
  cpSync(resolve(root, dir), resolve(standalone, dir), { recursive: true })
}
console.log(
  "[prepare-standalone] public/ and .next/static/ copied into .next/standalone/"
)
