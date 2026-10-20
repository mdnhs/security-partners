import { afterAll } from "vitest"

import { closeDb } from "@/server/db/client"

import { TEST_DATABASE_URL } from "./db"

// Integration tests always run against sp_test with fixed, test-only secrets.
process.env.DATABASE_URL = TEST_DATABASE_URL
process.env.BETTER_AUTH_SECRET = "test-secret-0123456789abcdef0123456789abcdef"
process.env.BETTER_AUTH_URL = "http://localhost:3000"

afterAll(async () => {
  await closeDb()
})
