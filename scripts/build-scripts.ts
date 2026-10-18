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
  "seed",
  "backup",
  "restore-drill",
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

/**
 * `next/cache` only works inside a Next request; the scripts share modules
 * that import it (server/auth/hooks.ts → server/lib/cache-tags.ts), so the
 * bundle gets stubs that throw when called — callers log, never rethrow —
 * instead of Next's server runtime and its optional OpenTelemetry peer.
 */
const nextCacheStub: Plugin = {
  name: "next-cache-stub",
  setup(b) {
    b.onResolve({ filter: /^next\/cache$/ }, () => ({
      path: "next/cache",
      namespace: "next-cache-stub",
    }))
    b.onLoad({ filter: /.*/, namespace: "next-cache-stub" }, () => ({
      contents: [
        "const outsideNext = (name) => () => {",
        "  throw new Error(`${name} is only available inside a Next.js request`)",
        "}",
        'export const revalidateTag = outsideNext("revalidateTag")',
        'export const revalidatePath = outsideNext("revalidatePath")',
        'export const updateTag = outsideNext("updateTag")',
        'export const cacheTag = outsideNext("cacheTag")',
        'export const cacheLife = outsideNext("cacheLife")',
      ].join("\n"),
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
    // pg lazily requires the optional native binding (never installed); sharp
    // is native and ships in the standalone node_modules (Next traces it).
    external: ["pg-native", "sharp"],
    // CommonJS dependencies (pg) call require(); give the ESM bundle one.
    banner: {
      js: 'import { createRequire as __spCreateRequire } from "node:module"; const require = __spCreateRequire(import.meta.url);',
    },
    plugins: [serverOnlyStub, nextCacheStub],
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
