# Security Partners — site and admin

Next.js 16 (App Router, Cache Components) public site + admin panel at
`/admin`, Hono API at `/api`, Better Auth, Drizzle + Postgres 17.
Design spec: `docs/superpowers/specs/2026-10-16-dynamic-platform-design.md`.
Operations: `docs/runbook.md`. Go-live: `docs/launch.md`. Content brief:
`docs/brief.md`.

The app reads exactly three environment variables: `DATABASE_URL`,
`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`. Everything else (SMTP, R2,
Turnstile, AI, tracking) is configured in the admin.

## Local development

```bash
pnpm install
cp .env.example .env.development   # dev-only values; `next build` never reads them
docker compose -f docker-compose.dev.yml up -d && pnpm db:migrate && pnpm db:seed && pnpm demo:seed --password "<12+ characters>" && pnpm dev
```

Postgres 17 (`sp_dev`, `sp_test`, `sp_e2e`) and Mailpit
(http://localhost:8025) run in Docker (`pnpm db:up` / `pnpm db:down`; data
stays in a Docker volume). Demo accounts: `<role>@demo.local` with your
password (`DEMO_PASSWORD` may replace `--password`). Remove them with
`pnpm demo:remove`.

## Checks

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` — the build needs
  no env and no database
  (`env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`).
- `pnpm test:unit` (no services), `pnpm test:integration` (Postgres +
  Mailpit; uses `sp_test`, migrated automatically; override with
  `TEST_DATABASE_URL`), `pnpm test:e2e` (Playwright on the standalone
  `server.js` of a production build, like the image; Postgres + Mailpit up,
  port 3100 must be free), `pnpm test:visual` (macOS only, 0 px vs
  baselines), `pnpm audit:deps` (production dependencies only).
- CI (`.github/workflows/ci.yml`) runs everything except the visual tests on
  pull requests and branches; on `main` it gates the deploy.

## Operator scripts

`pnpm db:seed`, `admin:create`, `owner:recover`, `demo:seed`, `demo:remove`,
`backup`, `restore-drill`, `secrets:rotate`, `db:sync` — locally with
`.env.development`; in the container as `node scripts/dist/<name>.mjs`.
See `docs/runbook.md`.

## Development notes

- Server code lives in `server/` (`import "server-only"` first);
  `lib/` and template schemas never import it (lint-enforced).
- Only `server/modules/*/repo.ts` and `server/db/**` use Drizzle; routes
  validate and authorise, then call a service; services audit every
  mutation.
- Never keep `getDb()` in a module-level constant (tests switch databases).
- Raw SQL inserts must supply the uuid v7 `id` (Drizzle's default runs only
  through the query builder).
- `pnpm db:generate --name <change>` after editing `server/db/schema/*`, then
  `pnpm db:migrate`. Migrations are forward-only.
- Scripts importing `server/**` run with `pnpm tsx:server <file.ts>` (loads
  `.env.development`, stubs `server-only`); `pnpm scripts:build` bundles them
  into `scripts/dist` for the image.
- The public design is frozen: public markup changes must keep every visual
  baseline at 0 px.
