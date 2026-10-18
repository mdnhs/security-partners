// Prepares sp_e2e for the admin E2E specs. Run by tests/e2e/global.setup.ts:
//   pnpm tsx:server tests/e2e/seed.ts   (env from tests/e2e/env.ts)
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

import { eq } from "drizzle-orm"
import { URI } from "otpauth"

import type { Role } from "@/lib/auth/roles"

import { getAuth } from "@/server/auth/auth"
import {
  createPasswordToken,
  INVITE_TOKEN_EXPIRES_IN,
  passwordUrl,
} from "@/server/auth/tokens"
import { closeDb, getDb } from "@/server/db/client"
import { seedContent } from "@/server/db/seed"
import { runMigrations } from "@/server/db/migrate"
import { settings } from "@/server/db/schema"
import { getEnv } from "@/server/env"
import { seedDemoUsers } from "@/server/modules/users/bootstrap"

import { resetDb } from "../integration/db"

import { E2E_ADMIN, E2E_OWNER } from "./admin-accounts"
import { assertE2eDatabase } from "./env"
import { E2E_PASSWORD, type E2EFixtures, FIXTURES_FILE } from "./fixtures"

const { DATABASE_URL } = getEnv()
assertE2eDatabase(DATABASE_URL)

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

/** Creates a user with a password, turns TOTP on, returns the otpauth URI. */
async function enrolTotp(
  person: { email: string; name: string },
  roles: Role[]
): Promise<string> {
  await auth.api.createUser({
    body: { ...person, role: roles, password: E2E_PASSWORD },
  })
  const signedIn = await auth.api.signInEmail({
    body: { email: person.email, password: E2E_PASSWORD },
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
  return enabled.totpURI
}

// Two-factor user: sign in, enable TOTP, confirm with a generated code.
const twoFactor = { email: "twofactor@e2e.test", name: "Tess Twofactor" }
const twoFactorUri = await enrolTotp(twoFactor, ["admin"])

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

// Articles workflow (Phase 5): an author who drafts and submits.
const author = { email: "author@e2e.test", name: "Arthur Author" }
await auth.api.createUser({
  body: { ...author, role: ["author"], password: E2E_PASSWORD },
})

// Leads (Phase 7): an intake user, staff notifications to a Mailpit inbox.
const intake = { email: "intake@e2e.test", name: "Ian Intake" }
await auth.api.createUser({
  body: { ...intake, role: ["intake"], password: E2E_PASSWORD },
})
const leadsInbox = "leads@e2e.test"
const leadsSettings = {
  recipients: [leadsInbox],
  retentionMonths: 24,
  acknowledgement: false,
}
await getDb()
  .update(settings)
  .set({ draft: leadsSettings, published: leadsSettings })
  .where(eq(settings.key, "leads"))

// Spec §15: one user per role (<role>@demo.local, password E2E_PASSWORD).
await seedDemoUsers(E2E_PASSWORD)

// account.spec turns 2FA off for this one.
const twoFactorOff = { email: "twofactor-off@e2e.test", name: "Toby Twofactor" }
const twoFactorOffUri = await enrolTotp(twoFactorOff, ["editor"])

// password-reset.spec: the production server refuses the loopback Mailpit
// (SMTP SSRF guard), so the seed mints the link the email would carry.
const resetPerson = { email: "reset@e2e.test", name: "Rita Reset" }
const { user: resetAccount } = await auth.api.createUser({
  body: { ...resetPerson, role: ["editor"], password: E2E_PASSWORD },
})
const resetUrl = passwordUrl(
  "reset-password",
  await createPasswordToken(resetAccount.id, INVITE_TOKEN_EXPIRES_IN)
)

const fixtures: E2EFixtures = {
  editor,
  invitee: { ...invitee, inviteUrl },
  twoFactor: { ...twoFactor, totpUri: twoFactorUri },
  account,
  author,
  intake,
  leadsInbox,
  twoFactorOff: { ...twoFactorOff, totpUri: twoFactorOffUri },
  resetUser: { ...resetPerson, resetUrl },
}
mkdirSync(dirname(FIXTURES_FILE), { recursive: true })
writeFileSync(FIXTURES_FILE, JSON.stringify(fixtures, null, 2))
await closeDb()
console.log("[e2e] sp_e2e migrated and seeded")
