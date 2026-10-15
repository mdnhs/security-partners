import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

const serverOnlyStub = fileURLToPath(
  new URL("./tests/stubs/server-only.ts", import.meta.url)
)

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // `server-only` throws outside Next's react-server bundles.
    alias: { "server-only": serverOnlyStub },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
          setupFiles: ["./tests/unit/setup.ts"],
        },
      },
    ],
  },
})
