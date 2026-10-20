import { existsSync } from "node:fs"

import { defineConfig } from "drizzle-kit"

if (!process.env.DATABASE_URL && existsSync(".env.development"))
  process.loadEnvFile(".env.development")

export default defineConfig({
  dialect: "postgresql",
  schema: "./server/db/schema/index.ts",
  out: "./server/db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
})
