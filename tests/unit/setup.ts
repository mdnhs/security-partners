// Unit tests must not depend on the developer's shell: drop app env vars.
// Tests that need them set them explicitly (see tests/unit/env.test.ts).
for (const key of ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"])
  delete process.env[key]
