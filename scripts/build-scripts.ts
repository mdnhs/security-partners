// Bundles the operational scripts into self-contained ESM files for the
// production image (which has no tsx and only the traced node_modules).
//   pnpm scripts:build  →  scripts/dist/<name>.mjs
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

import { build, type Plugin } from "esbuild"

/** Scripts shipped in the image. Later phases append their script names. */
export const SCRIPT_ENTRIES = [
  "migrate",
  "admin-create",
  "owner-recover",
  "demo-seed",
] as const

/** `server-only` throws outside Next's react-server bundles; scripts get an empty module. */
const serverOnlyStub: Plugin = {
  name: "server-only-stub",
  setup(b) {
    b.onResolve({ filter: /^server-only$/ }, () => ({
      path: "server-only",
      namespace: "server-only-stub",
    }))
    b.onLoad({ filter: /.*/, namespace: "server-only-stub" }, () => ({
      contents: "export {}",
      loader: "js",
    }))
  },
}

export async function buildScripts(
  outdir = resolve("scripts/dist")
): Promise<string[]> {
  await build({
    entryPoints: SCRIPT_ENTRIES.map((name) => resolve("scripts", `${name}.ts`)),
    outdir,
    outExtension: { ".js": ".mjs" },
    bundle: true,
    platform: "node",
    target: "node22",
    format: "esm",
    tsconfig: resolve("tsconfig.json"),
    // pg lazily requires the optional native binding; it is never installed.
    external: ["pg-native"],
    // CommonJS dependencies (pg) call require(); give the ESM bundle one.
    banner: {
      js: 'import { createRequire as __spCreateRequire } from "node:module"; const require = __spCreateRequire(import.meta.url);',
    },
    plugins: [serverOnlyStub],
    legalComments: "none",
    logLevel: "warning",
  })
  return SCRIPT_ENTRIES.map((name) => resolve(outdir, `${name}.mjs`))
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const files = await buildScripts()
  console.log(`[scripts:build] ${files.length} script(s) → scripts/dist`)
}
