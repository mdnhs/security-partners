import { execFileSync } from "node:child_process"

import { test as setup } from "@playwright/test"

import { E2E_ENV } from "./env"

// Runs before the "e2e" project (playwright.config.ts dependencies). The seed
// imports server code, so it runs under tsx with the server-only hook.
setup("migrate and seed sp_e2e", () => {
  execFileSync("pnpm", ["tsx:server", "tests/e2e/seed.ts"], {
    stdio: "inherit",
    env: { ...process.env, ...E2E_ENV },
  })
})
