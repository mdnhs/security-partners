// Lets Node-run tools (tsx scripts, drizzle-kit) load server/** modules.
// `server-only` throws unless it is resolved with the "react-server"
// condition, which only Next's server bundles use. Outside Next we point
// this one specifier at the package's own empty.js; every other package
// keeps normal resolution (react-dom/server must never see "react-server").
// Vitest uses resolve.alias and the esbuild script bundle a plugin instead.
import { createRequire, registerHooks } from "node:module"
import { dirname, join } from "node:path"
import { pathToFileURL } from "node:url"

const require = createRequire(import.meta.url)
const EMPTY_URL = pathToFileURL(
  join(dirname(require.resolve("server-only")), "empty.js")
).href

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only")
      return { url: EMPTY_URL, shortCircuit: true }
    return nextResolve(specifier, context)
  },
})
