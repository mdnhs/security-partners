// Users + Audit log screens (Phase 4 Task 12): an owner and a plain admin,
// created by tests/e2e/seed.ts with E2E_PASSWORD. Fixed values (no token or
// generated state), so they live here rather than in fixtures.json.
export const E2E_OWNER = {
  email: "owner@e2e.test",
  name: "Olive Owner",
} as const
export const E2E_ADMIN = {
  email: "admin@e2e.test",
  name: "Adam Admin",
} as const
