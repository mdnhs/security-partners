// Gives the server under test (playwright.config.ts webServer) a database
// with exactly the seeded content, so screenshots compare seed → Phase 0
// baselines, plus the admin the shell screenshots sign in as. Runs before
// the standalone server.js on every Playwright run:
//   pnpm tsx:server tests/visual/seed.ts   (env from tests/e2e/env.ts)
import { getAuth } from "@/server/auth/auth"
import { closeDb, getDb } from "@/server/db/client"
import { runMigrations } from "@/server/db/migrate"
import { seedContent } from "@/server/db/seed"
import { getEnv } from "@/server/env"

import { assertE2eDatabase } from "../e2e/env"
import { resetDb } from "../integration/db"

import { VISUAL_ADMIN, VISUAL_AUTHOR, VISUAL_EDITOR } from "./admin-user"

const { DATABASE_URL } = getEnv()
assertE2eDatabase(DATABASE_URL)
const name = new URL(DATABASE_URL).pathname

await runMigrations(DATABASE_URL)
await resetDb()
const report = await seedContent(getDb())
const auth = getAuth()
await auth.api.createUser({
  body: {
    email: VISUAL_ADMIN.email,
    name: VISUAL_ADMIN.name,
    role: ["admin"],
    password: VISUAL_ADMIN.password,
  },
})
await auth.api.createUser({
  body: {
    email: VISUAL_EDITOR.email,
    name: VISUAL_EDITOR.name,
    role: ["editor"],
    password: VISUAL_EDITOR.password,
  },
})
await auth.api.createUser({
  body: {
    email: VISUAL_AUTHOR.email,
    name: VISUAL_AUTHOR.name,
    role: ["author"],
    password: VISUAL_AUTHOR.password,
  },
})
await closeDb()
console.log(
  `[visual] ${name.slice(1)} reset and seeded (${report.pages} pages, 1 admin, 1 editor, 1 author)`
)
