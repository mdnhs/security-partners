// Shared by playwright.config.ts (webServer env) and the E2E setup/specs.
export const PORT = Number(process.env.PW_PORT ?? 3100)
export const BASE_URL = `http://127.0.0.1:${PORT}`

/** The server under test and the seed script both use exactly these values. */
export const E2E_ENV = {
  DATABASE_URL:
    process.env.E2E_DATABASE_URL ?? "postgres://sp:sp@127.0.0.1:5432/sp_e2e",
  BETTER_AUTH_SECRET: "e2e-only-secret-0123456789abcdef0123456789",
  BETTER_AUTH_URL: BASE_URL,
}
