import type { SmtpConfig } from "@/lib/schemas/integrations"
import { getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"

/**
 * Saves integrations.smtp the way the Phase 6 integrations service stores
 * it (values in `draft`, empty secret as "", published null). Defaults to
 * the dev Mailpit without authentication.
 *
 * Only an empty `password` is supported: it is stored as "" (no secret).
 * A real password would have to be encrypted with `encryptSecret(…,
 * "integrations.smtp.password")` the way the integrations service does.
 */
export async function configureSmtp(values: Partial<SmtpConfig> = {}) {
  const draft: SmtpConfig = {
    host: "127.0.0.1",
    port: 1025,
    secure: false,
    user: "",
    password: "",
    fromName: "Security Partners Test",
    fromAddress: "website@example.test",
    ...values,
  }
  await getDb()
    .insert(settings)
    .values({ key: "integrations.smtp", draft, published: null, version: 1 })
    .onConflictDoUpdate({ target: settings.key, set: { draft } })
}
