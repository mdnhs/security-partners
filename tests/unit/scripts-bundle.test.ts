import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { buildScripts, SCRIPT_ENTRIES } from "../../scripts/build-scripts"

// The bundle is written to a temp dir outside the repo, so running it there
// proves it needs no node_modules (the production image has none for scripts).
const outdir = mkdtempSync(join(tmpdir(), "sp-scripts-"))
let files: string[] = []

beforeAll(async () => {
  files = await buildScripts(outdir)
}, 60_000)
afterAll(() => rmSync(outdir, { recursive: true, force: true }))

describe("scripts bundle", () => {
  it("emits one .mjs per entry", () => {
    expect(files.map((f) => f.slice(outdir.length + 1))).toEqual(
      SCRIPT_ENTRIES.map((n) => `${n}.mjs`)
    )
  })

  it("stubs server-only (its throwing module is not in the bundle)", () => {
    const code = readFileSync(join(outdir, "migrate.mjs"), "utf8")
    expect(code).not.toContain("cannot be imported from a Client Component")
  })

  it("migrate.mjs runs standalone and exits 1 listing every missing env var", () => {
    const env = { ...process.env }
    for (const key of ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"])
      delete env[key]
    const run = spawnSync(process.execPath, [join(outdir, "migrate.mjs")], {
      cwd: outdir,
      env,
      encoding: "utf8",
    })
    expect(run.status).toBe(1)
    expect(run.stderr).toContain("[migrate] Invalid environment configuration:")
    expect(run.stderr).toContain("  - DATABASE_URL: is required")
    expect(run.stderr).toContain("  - BETTER_AUTH_SECRET: is required")
    expect(run.stderr).toContain("  - BETTER_AUTH_URL: is required")
  })
})
