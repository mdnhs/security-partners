// Prepares sp_e2e for the admin E2E specs. Run by tests/e2e/global.setup.ts:
//   pnpm tsx:server tests/e2e/seed.ts   (env from tests/e2e/env.ts)
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

import { URI } from "otpauth"

import { getAuth } from "@/server/auth/auth"
import {
  createPasswordToken,
  INVITE_TOKEN_EXPIRES_IN,
  passwordUrl,
} from "@/server/auth/tokens"
import { closeDb, getDb } from "@/server/db/client"
import { seedContent } from "@/server/db/seed"
import { runMigrations } from "@/server/db/migrate"
import { getEnv } from "@/server/env"

import { resetDb } from "../integration/db"

import { E2E_ADMIN, E2E_OWNER } from "./admin-accounts"
import { E2E_PASSWORD, type E2EFixtures, FIXTURES_FILE } from "./fixtures"

const { DATABASE_URL } = getEnv()
if (new URL(DATABASE_URL).pathname !== "/sp_e2e")
  throw new Error(
    `Refusing to reset a non-E2E database (${new URL(DATABASE_URL).pathname})`
  )

await runMigrations(DATABASE_URL)
await resetDb()
// The public site needs its content (Phase 3); users are created below.
await seedContent(getDb())
const auth = getAuth()

const editor = { email: "editor@e2e.test", name: "Edith Editor" }
await auth.api.createUser({
  body: { ...editor, role: ["editor"], password: E2E_PASSWORD },
})

const invitee = { email: "invitee@e2e.test", name: "Ivy Invitee" }
const { user: invited } = await auth.api.createUser({
  body: { ...invitee, role: ["viewer"] },
})
const inviteUrl = passwordUrl(
  "set-password",
  await createPasswordToken(invited.id, INVITE_TOKEN_EXPIRES_IN)
)

// Two-factor user: sign in, enable TOTP, confirm with a generated code.
const twoFactor = { email: "twofactor@e2e.test", name: "Tess Twofactor" }
await auth.api.createUser({
  body: { ...twoFactor, role: ["admin"], password: E2E_PASSWORD },
})
const signedIn = await auth.api.signInEmail({
  body: { email: twoFactor.email, password: E2E_PASSWORD },
  returnHeaders: true,
})
const headers = new Headers({
  cookie: signedIn.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; "),
})
const enabled = await auth.api.enableTwoFactor({
  body: { password: E2E_PASSWORD },
  headers,
})
if (enabled.method !== "totp") throw new Error("expected a TOTP enrolment")
await auth.api.verifyTOTP({
  body: { code: URI.parse(enabled.totpURI).generate() },
  headers,
})

// Account page user (Task 2.6): turns 2FA on through the UI.
const account = { email: "account@e2e.test", name: "Avery Account" }
await auth.api.createUser({
  body: { ...account, role: ["editor"], password: E2E_PASSWORD },
})

// Users + Audit log screens (Phase 4 Task 12): an owner and a plain admin.
await auth.api.createUser({
  body: { ...E2E_OWNER, role: ["owner"], password: E2E_PASSWORD },
})
await auth.api.createUser({
  body: { ...E2E_ADMIN, role: ["admin"], password: E2E_PASSWORD },
})

const fixtures: E2EFixtures = {
  editor,
  invitee: { ...invitee, inviteUrl },
  twoFactor: { ...twoFactor, totpUri: enabled.totpURI },
  account,
}
mkdirSync(dirname(FIXTURES_FILE), { recursive: true })
writeFileSync(FIXTURES_FILE, JSON.stringify(fixtures, null, 2))
await closeDb()
console.log("[e2e] sp_e2e migrated and seeded")
