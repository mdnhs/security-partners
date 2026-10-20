// Shared by playwright.config.ts (webServer env), the seeds and the specs.
// No server imports here: playwright.config.ts loads this file.
export const PORT = Number(process.env.PW_PORT ?? 3100)
export const BASE_URL = `http://127.0.0.1:${PORT}`

/** The server under test and the seed scripts all use exactly these values. */
export const E2E_ENV = {
  DATABASE_URL:
    process.env.E2E_DATABASE_URL ?? "postgres://sp:sp@127.0.0.1:5432/sp_e2e",
  BETTER_AUTH_SECRET: "e2e-only-secret-0123456789abcdef0123456789",
  BETTER_AUTH_URL: BASE_URL,
}

/** The standalone server.js reads PORT and HOSTNAME (production parity). */
export const SERVER_ENV: Record<string, string> = {
  ...E2E_ENV,
  PORT: String(PORT),
  HOSTNAME: "127.0.0.1",
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"])

/** The visual and E2E seeds truncate everything: only a local *_e2e database. */
export function assertE2eDatabase(url: string): void {
  let ok = false
  try {
    const parsed = new URL(url)
    ok =
      LOOPBACK.has(parsed.hostname) &&
      /^\/[A-Za-z0-9_]+_e2e$/.test(parsed.pathname)
  } catch {
    ok = false
  }
  if (!ok)
    throw new Error(
      "Refusing to reset a database that is not a local *_e2e database"
    )
}
