# Next.js template

This is a Next.js template with shadcn/ui.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```

## Local development

```bash
pnpm install
cp .env.example .env.development   # dev-only values; `next build` never reads them
pnpm db:up                          # Postgres 17 (sp_dev, sp_test, sp_e2e) + Mailpit (http://localhost:8025)
pnpm db:migrate
pnpm dev
```

- `pnpm test:unit` — unit tests, no services needed.
- `pnpm test:integration` — needs `pnpm db:up`; uses the `sp_test` database and migrates it automatically. It fails loudly when Postgres is not reachable (CI provides a postgres service). Override the URL with `TEST_DATABASE_URL`.
- `pnpm test` — both projects.
- `pnpm db:generate --name <change>` after editing `server/db/schema/*`, then `pnpm db:migrate`.
- Scripts that import `server/**` run with `pnpm tsx:server <file.ts>` (loads `.env.development` and stubs `server-only` outside Next).
- `pnpm db:down` stops the services (data is kept in a Docker volume).
