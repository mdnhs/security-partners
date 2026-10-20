# Library API reference: verified 2026-10-16
Stack: Next.js 16.3, React 19.3, TypeScript, pnpm 10, Node 22. All APIs below were checked against **installed `.d.ts` files** in a throwaway probe (not the project). Most code blocks type-check with `tsc --strict` (Hono, Better Auth, Drizzle, Table, Query, RHF). TipTap, React Email, and sharp were also run in a Node 22 smoke test. ⚠ marks a breaking change vs an older major.

| Package | Version | Notes |
|---|---|---|
| hono / @hono/zod-validator | 4.13.13 / 0.9.1 | `hono/vercel` deprecated, use `app.fetch` or `@hono/vercel@1.0.1` |
| better-auth | 1.7.10 | CLI is now the **`auth`** package (`npx auth@1.7.10 generate`), `@better-auth/cli` deprecated |
| drizzle-orm / drizzle-kit / pg | 0.45.4 / 0.31.11 / 8.23.1 | still RQB v1 `relations()` |
| zod | 4.6.7 | `z.email()`, `{ error }`, `z.flattenError` |
| @tanstack/react-table | 9.3.1 | ⚠ new major: `useTable` + `tableFeatures`, ESM-only |
| @tanstack/react-query | 5.104.3 | `environmentManager.isServer()`, `queryClient.query()` |
| react-hook-form / @hookform/resolvers | 7.90.0 / 5.9.1 | 3-generic `useForm<In, Ctx, Out>` |
| @tiptap/react, starter-kit, html, static-renderer, core, pm | 3.32.0 | `core` + `pm` are peer dependencies; `@tiptap/html` needs `happy-dom@^20` |
| @dnd-kit/core / sortable / utilities / modifiers | 6.3.1 / 10.0.0 / 3.2.2 / 9.0.0 | |
| **react-email** (replaces @react-email/components) | 6.11.2 | ⚠ `@react-email/components` 1.0.12 is **deprecated** |
| nodemailer | 10.1.1 | types bundled, so drop `@types/nodemailer` |
| @aws-sdk/client-s3 (+ s3-request-presigner) | 3.1152.0 | |
| sharp | 0.35.5 | Node >=20.9, no install script |
| vitest (+ **vite** peer) | 5.0.5 (vite 8.3.4) | ⚠ `vite` must be listed explicitly |
| @playwright/test | 1.64.1 | |
| ai / @ai-sdk/anthropic / @ai-sdk/openai | 7.0.142 / 4.0.81 / 4.0.95 | ⚠ `system`→`instructions`, `onFinish`→`onEnd` |
| uuidv7 | 1.2.1 | |

```bash
pnpm add hono@4.13.13 @hono/zod-validator@0.9.1 better-auth@1.7.10 drizzle-orm@0.45.4 pg@8.23.1 zod@4.6.7 uuidv7@1.2.1 \
  @tanstack/react-query@5.104.3 @tanstack/react-table@9.3.1 react-hook-form@7.90.0 @hookform/resolvers@5.9.1 \
  @tiptap/react@3.32.0 @tiptap/pm@3.32.0 @tiptap/core@3.32.0 @tiptap/starter-kit@3.32.0 @tiptap/html@3.32.0 @tiptap/static-renderer@3.32.0 happy-dom@^20 \
  @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0 @dnd-kit/utilities@3.2.2 @dnd-kit/modifiers@9.0.0 \
  react-email@6.11.2 nodemailer@10.1.1 @aws-sdk/client-s3 @aws-sdk/s3-request-presigner sharp@0.35.5 \
  ai@7.0.142 @ai-sdk/anthropic @ai-sdk/openai
pnpm add -D drizzle-kit@0.31.11 @types/pg vitest@5.0.5 vite@8 happy-dom@^20 @playwright/test@1.64.1 auth@1.7.10
```
Next 16 already externalizes `sharp` and `@aws-sdk/client-s3`. Add `nodemailer`, `happy-dom`, or `react-email` to `serverExternalPackages` only if bundling breaks. Everything here runs on the Node runtime only, not edge.

---

## 1. Hono 4.13 + @hono/zod-validator 0.9.1 (Zod 4)
**Changes to know**
- `hono/vercel` `handle()` is `@deprecated` (removed in Hono v5). Either install `@hono/vercel@1.0.1` (peer `hono >=4.13.9`) or skip adapters and call `app.fetch(req)` directly. The second option needs no extra dependency and is what we use.
- `@hono/zod-validator` 0.9 accepts both Zod 3.25+ and Zod 4. The hook's `result.error` is the Zod 4 core `$ZodError`. Use `z.flattenError(err)` because `err.flatten()` is deprecated in Zod 4.
- New middleware: `methodNotAllowed({ app })` from `hono/method-not-allowed` returns a 405 with an `Allow` header.
- `hono/client` now exports `parseResponse()`, which returns the JSON or throws `DetailedError` when the response is not ok.
- `requestId()` reuses an incoming `X-Request-Id` header (up to `limitLength`, default 255). If there is none, it calls `generator(c)`.

```ts
// src/server/http/validate.ts
import type { ValidationTargets } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

export const zv = <T extends z.ZodType, Target extends keyof ValidationTargets>(target: Target, schema: T) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const { fieldErrors, formErrors } = z.flattenError(result.error);
      return c.json({ error: { code: "VALIDATION_ERROR", message: formErrors[0] ?? "Invalid input", fieldErrors } }, 422);
    }
  }); // the 422 body type propagates into the hc<> client types (verified)
```
```ts
// src/server/http/app.ts
import { Hono } from "hono";
import { requestId, type RequestIdVariables } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { uuidv7 } from "uuidv7";
import { zv } from "./validate";
import { auth } from "@/server/auth";

type Env = { Variables: RequestIdVariables & {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null } };

// Sub-routers MUST be chained (.get().post()) for RPC types to accumulate.
const posts = new Hono<Env>()
  .get("/", zv("query", z.object({ page: z.coerce.number().int().min(1).default(1), q: z.string().optional() })), (c) => {
    const { page, q } = c.req.valid("query");
    return c.json({ items: [{ id: "1", title: q ?? "" }], page, pageCount: 1 }, 200);
  })
  .post("/", zv("json", z.object({ title: z.string().min(1), email: z.email() })), (c) =>
    c.json({ id: uuidv7(), ...c.req.valid("json") }, 201))
  .get("/:id", (c) => c.json({ id: c.req.param("id") }));

const app = new Hono<Env>().basePath("/api");
app.use("*", requestId({ generator: () => uuidv7() }));            // c.get("requestId")
app.use("*", secureHeaders());                                       // options: contentSecurityPolicy, strictTransportSecurity, xFrameOptions, permissionsPolicy, removePoweredBy…
app.use("*", bodyLimit({ maxSize: 1024 * 1024,
  onError: (c) => c.json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Body too large" } }, 413) }));
app.on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw)); // Better Auth under /api/auth/*
app.use("*", async (c, next) => {
  const s = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set("user", s?.user ?? null); c.set("session", s?.session ?? null);
  await next();
});
app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: { code: `HTTP_${err.status}`, message: err.message } }, err.status);
  console.error({ requestId: c.get("requestId"), err });
  return c.json({ error: { code: "INTERNAL", message: "Internal error", requestId: c.get("requestId") } }, 500);
});
app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404));

const routes = app.route("/posts", posts);   // capture the return value, it carries the types
export type AppType = typeof routes;
export default app;
```
```ts
// app/api/[...route]/route.ts   (basePath('/api') matches the folder)
import app from "@/server/http/app";
const handler = (req: Request) => app.fetch(req);
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE, handler as OPTIONS };
// alternative: import { handle } from "@hono/vercel"; export const GET = handle(app) …
```
```ts
// client side (typed RPC)
import { hc, parseResponse, type InferResponseType, type InferRequestType } from "hono/client";
import type { AppType } from "@/server/http/app";
export const api = hc<AppType>("/");                    // absolute URL on server: hc<AppType>(env.APP_URL)
type PostsList = InferResponseType<typeof api.api.posts.$get, 200>;
type CreatePost = InferRequestType<typeof api.api.posts.$post>["json"];
const res = await api.api.posts.$get({ query: { page: "2" } }); // query values are strings
if (res.status === 422) (await res.json()).error.fieldErrors;   // typed from hook
const created = await parseResponse(api.api.posts.$post({ json: { title: "t", email: "a@b.co" } })); // throws DetailedError on !ok
await api.api.posts[":id"].$get({ param: { id: "1" } });
```

---

## 2. Better Auth 1.7.10
**Changes to know**
- **The CLI package was renamed.** `@better-auth/cli` is deprecated on npm. Use `npx auth@1.7.10 generate` (package `auth`, bins `auth`/`better-auth`). `auth migrate` only works with the built-in Kysely adapter. With Drizzle, run `auth generate` and then drizzle-kit.
- **Runtime schema validation is on by default** (`advanced.database.validateSchema: true`). With Drizzle, you **must pass `schema`** to `drizzleAdapter`, or every auth request fails with "Drizzle schema mismatch: Missing tables …" (seen in the probe).
- `twoFactor.enable` takes `method: "otp" | "totp"` (default `"totp"`). The response is now a **discriminated union** (`{method:"otp"}` or `{method:"totp", totpURI, backupCodes}`), so narrow on `data.method` first.
- 2FA has a new account lockout (`accountLockout`, default 10 failures leads to a 15-minute lock). It adds the columns `two_factor.failed_verification_count`, `locked_until`, and `verified`.
- Admin: the `impersonate-admins` permission replaces `allowImpersonatingAdmins` (now deprecated). `role` accepts `string | string[]` and is stored comma-joined.
- `experimental.joins` moved to `advanced.database.joins`. Drizzle schemas now need `relations` (the generator emits them).
- A custom `rateLimit.customStorage` must implement atomic `consume(key,{window,max})` because `get`/`set` storage was removed. `storage:"database"` uses the `rate_limit` table.
- `cookieCache.strategy` is `"compact"` by default (alternatives are `"jwt"` and `"jwe"`). There is a new `refreshCache` option.
- Other 1.7 breaking changes (not relevant to us): social accounts are scoped by `Account.issuer`; generic-oauth now uses `signIn.social`; the MCP plugin moved to `@better-auth/mcp`; the `oidc-provider` plugin was removed.

```ts
// src/server/auth/index.ts
import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, twoFactor } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc } from "better-auth/plugins/admin/access";
import { nextCookies } from "better-auth/next-js";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";   // must include user/session/account/verification/twoFactor/rateLimit

export const ac = createAccessControl({ ...defaultStatements, post: ["create", "update", "delete", "publish"] } as const);
export const roles = {
  admin:  ac.newRole({ ...adminAc.statements, post: ["create", "update", "delete", "publish"] }),
  editor: ac.newRole({ post: ["create", "update"] }),
  user:   ac.newRole({ post: [] }),
};

export const auth = betterAuth({
  appName: "Security Partners",
  baseURL: process.env.BETTER_AUTH_URL,          // or { allowedHosts: [...], fallback, protocol }
  secret: process.env.BETTER_AUTH_SECRET,        // high entropy or it warns
  database: drizzleAdapter(db, { provider: "pg", schema, transaction: true }), // camelCase:false => snake_case cols
  emailAndPassword: {
    enabled: true, disableSignUp: true, minPasswordLength: 12, maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true, resetPasswordTokenExpiresIn: 3600,
    sendResetPassword: async ({ user, url, token }, request) => { /* send mail; don't await long work */ },
    onPasswordReset: async ({ user }, request) => {},
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, freshAge: 60 * 10,
    cookieCache: { enabled: true, maxAge: 5 * 60 /*, strategy: "compact" */ },
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL!],   // or (request) => [...]
  rateLimit: {
    enabled: true, storage: "database", window: 60, max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/two-factor/*": { window: 60, max: 5 },
      "/request-password-reset": { window: 300, max: 3 },
      "/get-session": false,
    },
  },
  advanced: {
    cookiePrefix: "sp", useSecureCookies: process.env.NODE_ENV === "production",
    ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"], trustedProxies: ["10.0.0.0/8"] },
    database: { generateId: "uuid" },   // see "UUID ids" below
    // trustedProxyHeaders: true  // only if you need x-forwarded-host/proto
  },
  databaseHooks: {
    session: { create: { after: async (session, ctx) => { /* audit: login (session.userId, session.ipAddress, session.userAgent) */ } } },
    user: { update: { after: async (user, ctx) => {} } },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-in/email") {
        const s = ctx.context.newSession;   // set on success. null on failure OR when a 2FA challenge is pending
        if (s) {/* audit sign_in.success s.user.id */} else {/* audit sign_in.failed ctx.body?.email */}
      }
      if (ctx.path.startsWith("/two-factor/verify")) {/* audit 2fa */}
      if (ctx.path === "/admin/impersonate-user") {/* audit */}
    }),
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") throw new APIError("FORBIDDEN", { message: "Sign up disabled" });
    }),
  },
  plugins: [
    admin({ ac, roles, defaultRole: "user", adminRoles: ["admin"],
      impersonationSessionDuration: 60 * 30, defaultBanReason: "Suspended", bannedUserMessage: "Account suspended" }),
    twoFactor({ issuer: "Security Partners",
      totpOptions: { digits: 6, period: 30 },
      backupCodeOptions: { amount: 10, length: 10, storeBackupCodes: "encrypted" },
      trustDeviceMaxAge: 60 * 60 * 24 * 30, twoFactorCookieMaxAge: 600,
      accountLockout: { maxFailedAttempts: 10, durationSeconds: 900 } }),
    nextCookies(),   // MUST be last. Lets auth.api.* calls in server actions set cookies
  ],
});
export type Session = typeof auth.$Infer.Session;
```

**Mounting.** Pick one of these:
```ts
// (a) dedicated route: app/api/auth/[...all]/route.ts
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth";
export const { GET, POST } = toNextJsHandler(auth);   // also returns PATCH/PUT/DELETE
// (b) inside Hono (above): app.on(["GET","POST"], "/auth/*", c => auth.handler(c.req.raw)) — basePath default "/api/auth" matches.
```

**Server session** (RSC, route handler, or Hono):
```ts
import { headers } from "next/headers";
const s = await auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } }); // authoritative DB read
// s?.user.role, s?.user.twoFactorEnabled, s?.session.impersonatedBy are typed
// also: query.disableRefresh. Server-side admin calls:
await auth.api.createUser({ body: { email, name, role: ["admin", "editor"] /* password optional */ }, headers });
await auth.api.userHasPermission({ body: { userId, permissions: { post: ["publish"] } } });
await auth.api.banUser({ body: { userId, banReason, banExpiresIn: 3600 }, headers });
await auth.api.setRole({ body: { userId, role: ["editor"] }, headers });
await auth.api.revokeUserSessions({ body: { userId }, headers });
await auth.api.impersonateUser({ body: { userId }, headers });
```
A user created without a password has no credential account. Send them a reset link instead (`auth.api.requestPasswordReset({ body:{ email, redirectTo } })`).

**Client**
```ts
"use client";
import { createAuthClient } from "better-auth/react";
import { adminClient, twoFactorClient } from "better-auth/client/plugins";
import { ac, roles } from "@/server/auth/permissions"; // keep ac/roles in an isomorphic file (no server-only import)
export const authClient = createAuthClient({
  plugins: [adminClient({ ac, roles }), twoFactorClient({ onTwoFactorRedirect: ({ twoFactorMethods }) => { location.href = "/admin/2fa"; } })],
});
await authClient.signIn.email({ email, password, rememberMe: true });
await authClient.twoFactor.verifyTotp({ code, trustDevice: true });
await authClient.twoFactor.verifyBackupCode({ code, trustDevice: true });
const { data } = await authClient.twoFactor.enable({ password, method: "totp" });
if (data?.method === "totp") { data.totpURI; data.backupCodes; }   // then verifyTotp to confirm
await authClient.admin.listUsers({ query: { limit: 20, offset: 0, sortBy: "createdAt", sortDirection: "desc", searchValue: q, searchField: "email" } });
authClient.admin.checkRolePermission({ role: "editor", permissions: { post: ["update"] } }); // sync, client-only check
await authClient.admin.stopImpersonating();
await authClient.requestPasswordReset({ email, redirectTo: "/reset" });  // (was forgetPassword in 1.2)
await authClient.resetPassword({ newPassword, token });
const { data: session, isPending } = authClient.useSession();
```
2FA endpoints: `/two-factor/{enable,disable,get-totp-uri,verify-totp,send-otp,verify-otp,verify-backup-code,generate-backup-codes}`.

**Schema generation**: `npx auth@1.7.10 generate --config src/server/auth/index.ts --output src/server/db/auth-schema.ts -y`. The probe output with admin, twoFactor, and rateLimit database storage is below. Table and column names are snake_case:
```
user(id, name, email UNIQUE, email_verified bool, image, created_at, updated_at, role, banned bool, ban_reason, ban_expires, two_factor_enabled bool)
session(id, expires_at, token UNIQUE, created_at, updated_at, ip_address, user_agent, user_id→user CASCADE, impersonated_by)  idx session_userId_idx
account(id, account_id, provider_id, user_id→user CASCADE, access_token, refresh_token, id_token, access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at)
verification(id, identifier, value, expires_at, created_at, updated_at)  idx verification_identifier_idx
two_factor(id, secret, backup_codes, user_id→user CASCADE, verified bool default true, failed_verification_count int default 0, locked_until)
rate_limit(id, key UNIQUE, count int, last_request bigint(mode number))
+ relations(): userRelations{sessions,accounts,twoFactors}, session/account/twoFactor → user
```
The generated timestamps are `timestamp()` **without** a timezone. You can hand-edit them to `{ withTimezone: true }` because the adapter only checks for "date". Model names in the schema object must be `user, session, account, verification, twoFactor, rateLimit`, or else use `usePlural` or `modelName`.

**UUID ids (verified in `get-id-field.mjs`)**
- `generateId: "uuid"`: the generator emits `uuid("id").default(sql\`pg_catalog.gen_random_uuid()\`)` and `uuid` FKs. Better Auth **omits the id on insert** and Postgres generates it. To get UUIDv7, swap the default to `sql\`uuidv7()\`` (Postgres 18 or newer) or `.$defaultFn(() => uuidv7())`. Drizzle applies that default because the adapter inserts through Drizzle. This option is recommended.
- `generateId: () => uuidv7()` (`GenerateIdFn({model,size})`): the generator emits **text** ids. Hand-edit them to `uuid` (the adapter accepts the "string" dataType). One caveat: deterministic single-use ids are base64url under a function strategy. Those are used only by SAML, DPoP, and private_key_jwt, none of which we use.
- `"uuid"` mode validates forced ids against `/[1-5]/` version digits, so v7 values passed via `forceAllowId` would be replaced. That path is internal and does not apply to normal inserts.

---

## 3. Drizzle ORM 0.45.4 / drizzle-kit 0.31.11 / pg 8.23
**Changes to know**
- `drizzle({ client: pool, schema, casing })` is the object form. The positional `drizzle(pool, { schema })` still type-checks.
- Table extras must be an **array** callback: `(t) => [index(...)]`. The object return is deprecated.
- `.for("update", { skipLocked: true })`: `LockConfig` is `{noWait:true} | {skipLocked:true} | {}`, and the two options are mutually exclusive.
- Relations: 0.45 still uses `relations()` (RQB v1, `db.query.x.findMany({ with })`). RQB v2 `defineRelations` belongs to drizzle-orm 1.0 (rc/beta). Better Auth supports both: `better-auth/adapters/drizzle` handles v1, and `@better-auth/drizzle-adapter/relations-v2` handles v2.

```ts
// src/server/db/schema.ts
import { pgTable, pgEnum, uuid, text, jsonb, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
export const postStatus = pgEnum("post_status", ["draft", "published", "archived"]);
const tsz = (n: string) => timestamp(n, { withTimezone: true, mode: "date" });   // timestamptz
export const posts = pgTable("post", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),      // or .default(sql`uuidv7()`) on PG18 / .defaultRandom() (v4)
  authorId: uuid("author_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  status: postStatus("status").notNull().default("draft"),
  body: jsonb("body").$type<{ type: "doc"; content?: unknown[] }>().notNull(),
  createdAt: tsz("created_at").notNull().defaultNow(),
  updatedAt: tsz("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [uniqueIndex("post_slug_uq").on(t.slug), index("post_author_idx").on(t.authorId)]);
export const postsRelations = relations(posts, ({ one }) => ({ author: one(user, { fields: [posts.authorId], references: [user.id] }) }));
export type Post = typeof posts.$inferSelect; export type NewPost = typeof posts.$inferInsert;
```
```ts
// src/server/db/index.ts
import "server-only";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
const g = globalThis as unknown as { pool?: Pool };
export const pool = g.pool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
if (process.env.NODE_ENV !== "production") g.pool = pool;   // survive HMR
export const db = drizzle({ client: pool, schema });
export type DB = typeof db;
```
```ts
// scripts/migrate.ts  (run before `next start`)
import { migrate } from "drizzle-orm/node-postgres/migrator";
await migrate(db, { migrationsFolder: "./drizzle" /*, migrationsTable: "__drizzle_migrations", migrationsSchema: "drizzle" */ });
await pool.end();
```
```ts
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",      // string | string[] (glob ok)
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true, verbose: true,
  // casing: "snake_case", migrations: { table: "__drizzle_migrations", schema: "drizzle" },
});
// pnpm drizzle-kit generate | migrate | push | studio | check
```
```ts
import { eq, and, desc, asc, count, ilike, sql } from "drizzle-orm";
const rows = await db.select().from(posts).where(and(eq(posts.status, "published"), ilike(posts.slug, `%${q}%`)))
  .orderBy(desc(posts.createdAt)).limit(20).offset((page - 1) * 20);
const [{ total }] = await db.select({ total: count() }).from(posts);
const withAuthor = await db.query.posts.findMany({ with: { author: true }, limit: 10, orderBy: [desc(posts.createdAt)] });
const [created] = await db.insert(posts).values({ authorId, slug, body }).returning();
// queue claim — FOR UPDATE SKIP LOCKED inside a tx
const claimed = await db.transaction(async (tx) => {
  const jobsDue = await tx.select().from(jobs)
    .where(sql`${jobs.runAt} <= now() and ${jobs.lockedAt} is null`)
    .orderBy(asc(jobs.runAt)).limit(5)
    .for("update", { skipLocked: true });            // "update" | "no key update" | "share" | "key share"
  for (const j of jobsDue) await tx.update(jobs).set({ lockedAt: new Date(), attempts: sql`${jobs.attempts} + 1` }).where(eq(jobs.id, j.id));
  return jobsDue;   // tx.rollback() throws to abort
}, { isolationLevel: "read committed" });
const raw = await db.execute<{ id: string }>(sql`select id from ${jobs} for update skip locked limit 1`); // raw.rows
```

---

## 4. Data tables & forms: TanStack Table 9.3.1 · Query 5.104.3 · RHF 7.90.0 + resolvers 5.9.1 + Zod 4.6.7
> Verified against installed `.d.ts` + bundled `skills/migrate-v8-to-v9` docs in table-core/react-table, plus tanstack.com React migration guide.
> All 3 code blocks below **type-check clean** (`tsc 5.9.3 --strict`, React 19.3 types); a negative file using v8 APIs fails as listed in 1b.

### 4.1 TanStack Table v9 — server-paginated + server-sorted + row selection
```tsx
'use client'
import { useState } from 'react'
import {
  useTable, tableFeatures, createColumnHelper,
  rowSortingFeature, rowPaginationFeature, rowSelectionFeature,
  type SortingState, type PaginationState, type RowSelectionState,
} from '@tanstack/react-table'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

type Partner = { id: string; name: string; email: string; createdAt: string }
type PartnerPage = { rows: Partner[]; rowCount: number }

// MODULE SCOPE: features/columns/empty-fallback must be referentially stable
const features = tableFeatures({
  rowSortingFeature,     // no `sortedRowModel` slot  -> no client sorting (server sorts)
  rowPaginationFeature,  // no `paginatedRowModel` slot -> no client slicing
  rowSelectionFeature,
})
const ch = createColumnHelper<typeof features, Partner>()   // v9: 2 generics
const columns = ch.columns([                                  // .columns() = new, keeps TValue inference
  ch.display({
    id: 'select', enableSorting: false,
    header: ({ table }) => (
      <input type="checkbox" checked={table.getIsAllPageRowsSelected()}
        ref={(el) => { if (el) el.indeterminate = table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected() }}
        onChange={table.getToggleAllPageRowsSelectedHandler()} />
    ),
    cell: ({ row }) => (
      <input type="checkbox" checked={row.getIsSelected()} disabled={!row.getCanSelect()}
        onChange={row.getToggleSelectedHandler()} />   // shift-range select ON by default in v9
    ),
  }),
  ch.accessor('name', { header: 'Name' }),
  ch.accessor('createdAt', { header: 'Created', cell: (i) => new Date(i.getValue()).toLocaleDateString() }),
])
const EMPTY: Partner[] = []

export const partnerKeys = {
  all: ['partners'] as const,
  list: (p: PaginationState, s: SortingState) => [...partnerKeys.all, 'list', p, s] as const,
}
async function fetchPartners(p: PaginationState, s: SortingState): Promise<PartnerPage> {
  const qs = new URLSearchParams({ page: String(p.pageIndex), size: String(p.pageSize) })
  if (s[0]) qs.set('sort', `${s[0].id}:${s[0].desc ? 'desc' : 'asc'}`)
  const r = await fetch(`/api/partners?${qs}`); if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

export function PartnersTable() {
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 })
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: partnerKeys.list(pagination, sorting),   // every server-owned slice in key
    queryFn: () => fetchPartners(pagination, sorting),
    placeholderData: keepPreviousData,                  // old page stays while next loads
  })
  const del = useMutation({
    mutationFn: async (ids: string[]) => {
      const r = await fetch('/api/partners', { method: 'DELETE', body: JSON.stringify({ ids }) })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
    },
    onSuccess: async (_data, ids) => {                  // sig: (data, vars, onMutateResult, context)
      setRowSelection((o) => Object.fromEntries(Object.entries(o).filter(([id]) => !ids.includes(id))))
      await qc.invalidateQueries({ queryKey: partnerKeys.all })   // prefix match -> all pages
    },
  })

  const table = useTable({
    features,                                   // REQUIRED option
    columns,
    data: query.data?.rows ?? EMPTY,            // feed query result directly, never copy into state
    rowCount: query.data?.rowCount,             // (or pageCount)
    getRowId: (row) => row.id,                  // stable ids -> selection survives paging
    manualPagination: true, manualSorting: true, // only bypass client stages; they never fetch
    state: { sorting, pagination, rowSelection },
    onSortingChange: (u) => { setSorting(u); setPagination((p) => ({ ...p, pageIndex: 0 })) },
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
  })

  return (
    <div>
      <button disabled={!table.getSelectedRowIds().length || del.isPending}
        onClick={() => del.mutate(table.getSelectedRowIds())}>Delete selected</button>
      <table>
        <thead>{table.getHeaderGroups().map((hg) => (
          <tr key={hg.id}>{hg.headers.map((h) => (
            <th key={h.id} colSpan={h.colSpan} onClick={h.column.getToggleSortingHandler()}>
              {h.isPlaceholder ? null : <table.FlexRender header={h} />}
              {{ asc: ' ▲', desc: ' ▼' }[h.column.getIsSorted() as string] ?? null}
            </th>))}
          </tr>))}
        </thead>
        <tbody>{table.getRowModel().rows.map((row) => (
          <tr key={row.id} data-selected={row.getIsSelected() || undefined}>
            {row.getAllCells().map((cell) => (   /* getVisibleCells needs columnVisibilityFeature */
              <td key={cell.id}><table.FlexRender cell={cell} /></td>))}
          </tr>))}
        </tbody>
      </table>
      <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Prev</button>
      <span>{table.state.pagination.pageIndex + 1}/{table.getPageCount()} ({table.getRowCount()}){query.isPlaceholderData && ' …'}</span>
      <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</button>
    </div>
  )
}
```
Alt to `useState`: `atoms: { pagination: useCreateAtom<PaginationState>(...) }` (`@tanstack/react-store`) — atoms beat `state`, `table.reset()` won't reset them. Reuse across many admin tables → `createTableHook({ features, tableComponents, cellComponents, headerComponents })` → `useAppTable`, `createAppColumnHelper<T>()`.

### 4.2 v8 → v9 breaking changes (each confirmed; `TC`=table-core/dist, `RT`=react-table/dist)
| v8 | v9 | evidence |
|---|---|---|
| `useReactTable` | `useTable(options, selector?)` — not exported at all (tsc TS2724) | `RT/useTable.d.ts`, `RT/index.d.ts` |
| all features implicit | `features: tableFeatures({...})` **required**; only registered features' APIs exist on types (`t.setSorting` TS2339 w/o `rowSortingFeature`). `stockFeatures` = kitchen-sink | `TC/core/table/coreTablesFeature.types.d.ts:65` `readonly features`; `TC/helpers/tableFeatures.d.ts` |
| `getCoreRowModel: getCoreRowModel()` | **removed**, automatic (stub only in `@tanstack/react-table/legacy`) | `RT/useLegacyTable.d.ts` "@deprecated The core row model is always created automatically" |
| `getSortedRowModel/getPaginationRowModel/getFilteredRowModel/...()` | slots inside `tableFeatures`: `sortedRowModel: createSortedRowModel()`, `paginatedRowModel: createPaginatedRowModel()`, `filteredRowModel: createFilteredRowModel()`, expanded/grouped/faceted*; factories take **no args** | `TC/types/TableFeatures.d.ts:56` `NonFeatureKeys` |
| `sortingFns`/`filterFns`/`aggregationFns` options | slots in `tableFeatures` (`sortFns: { alphanumeric: sortFn_alphanumeric }`); string names only resolve if registered (incl. `'auto'`) | `TableFeatures.d.ts:209,250` |
| `sortingFn`, `getSortingFn`, `getAutoSortingFn`, `SortingFn(s)` | `sortFn`, `getSortFn`, `getAutoSortFn`, `SortFn(s)` | `TC/features/row-sorting/rowSortingFeature.types.d.ts:88,116,146` |
| `createColumnHelper<TData>()` | `createColumnHelper<TFeatures, TData>()` (TS2558 w/ 1 arg); new `helper.columns([...])` | `TC/helpers/columnHelper.d.ts` |
| `ColumnDef<TData>`, `Row<TData>`, `Table<TData>`, `Cell<TData,V>`, `Column<TData>` | `TFeatures` added as 1st generic; `TableMeta`/`ColumnMeta` augmentation too (or `tableMeta: metaHelper<T>()` slot) | migrate skill `references/typescript.md` |
| `RowData = unknown` | `Record<string, any> \| Array<any>` (no primitive rows) | `TC/types/type-utils.d.ts:4` |
| `table.getState()` | `table.state` (selected, reactive), `table.store.state` (snapshot), `table.atoms.<slice>.get()` | tsc TS2339; `RT/useTable.d.ts` |
| `onStateChange` (global) | **removed**; per-slice `on*Change` kept; `table.store.subscribe()` | migrate `references/state.md` |
| — | `table.Subscribe` / standalone `<Subscribe source selector>` for fine-grained re-render; 2nd arg of `useTable` narrows `table.state` | `RT/Subscribe.d.ts` |
| — | new `atoms` option (external TanStack Store atoms per slice; precedence atoms > state > baseAtoms) | `coreTablesFeature.types.d.ts:33,73` |
| `flexRender(def, ctx)` | still works; new `<table.FlexRender cell/header/footer={x} />` + standalone `FlexRender` | `RT/FlexRender.d.ts` |
| `row.getVisibleCells()` always | needs `columnVisibilityFeature`; core = `row.getAllCells()` | `TC/features/column-visibility/columnVisibilityFeature.types.d.ts:70` |
| `getIsSomeRowsSelected()` = some-but-not-all | = **at least one** (true when all) → indeterminate = `some && !all` | migrate `references/feature-apis.md` |
| toggle handler = single toggle | `getToggleSelectedHandler()` does Shift-range by default (`enableRowRangeSelection: false` to disable); new `table.getSelectedRowIds()` | `rowSelectionFeature.types.d.ts:36,127` |
| pinning `left`/`right` | `start`/`end` everywhere (`getStartVisibleCells`, `columnPinning.start`, `pin('start')`), no aliases; `enablePinning` (table) → `enableColumnPinning`/`enableRowPinning` | feature-apis.md |
| CJS/UMD builds | **ESM-only** (`"type":"module"`, exports only `.js`), ES2022, node ≥20 engines, react peer `>=18` | `RT/package.json` |
| — | temp bridge: `useLegacyTable` + `legacyCreateColumnHelper` from `@tanstack/react-table/legacy` (deprecated, bundles all features) | `RT/legacy.d.ts` |

### 4.3 TanStack Query 5.104 — Next App Router provider
```tsx
// app/providers.tsx
'use client'
import { QueryClient, QueryClientProvider, environmentManager } from '@tanstack/react-query'
import type { ReactNode } from 'react'

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } }) // >0: no refetch right after hydrate
}
let browserQueryClient: QueryClient | undefined
function getQueryClient() {
  if (environmentManager.isServer()) return makeQueryClient()   // new client per request
  return (browserQueryClient ??= makeQueryClient())              // browser singleton
}
export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient() // no useState: React drops state if it suspends before first render
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
// app/layout.tsx (server): <body><Providers>{children}</Providers></body>
```
Late-5.x changes (from `query-core/build/modern/*.d.ts`):
- `isServer` (boolean const) still exported but **`@deprecated use environmentManager.isServer()`** (`hydration-*.d.ts:1161`). `environmentManager.setIsServer(fn)` overrides detection (e.g. service worker).
- `queryClient.fetchQuery/prefetchQuery/ensureQueryData` + infinite variants **deprecated → `queryClient.query(opts)` / `queryClient.infiniteQuery(opts)`**; ensure = `query({ ...opts, staleTime: 'static' })`; prefetch = `query(opts).catch(noop)`. Removal next major.
- Mutation callbacks: `onMutate(vars, context)`, `onSuccess(data, vars, onMutateResult, context)`, `onError(err, vars, onMutateResult, context)` — 3rd arg was "context" in early v5, now `onMutateResult`; new 4th `context: MutationFunctionContext` (has `client`). `mutationFn(vars, context)`.
- New exports: `mutationOptions`, `experimental_streamedQuery`, `timeoutManager`, `environmentManager`. Unchanged: `keepPreviousData`, `isPending`, `gcTime`, `placeholderData`, `invalidateQueries({ queryKey })`.

### 4.4 RHF 7.90 + `@hookform/resolvers/zod` 5.9 + Zod 4.6
```tsx
'use client'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'                                   // 'zod' root = v4 classic

export const partnerSchema = z.object({
  name: z.string().trim().min(2, { error: 'Name too short' }),   // `error`, not `message`
  email: z.email({ error: 'Invalid email' }),                  // top-level, not z.string().email()
  website: z.url().optional().or(z.literal('')),
  seats: z.coerce.number<string>().int().min(1),   // coerce input is `unknown` unless generic given
  tier: z.enum(['basic', 'pro']).default('basic'), // input optional, output required
})
type PartnerInput = z.input<typeof partnerSchema>
type PartnerOutput = z.output<typeof partnerSchema>

export function PartnerForm({ onSave }: { onSave: (v: PartnerOutput) => Promise<void> }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<PartnerInput, unknown, PartnerOutput>({          // <TFieldValues=input, TContext, TTransformed=output>
      resolver: zodResolver(partnerSchema),
      defaultValues: { name: '', email: '', website: '', seats: '1' },
    })
  const onSubmit: SubmitHandler<PartnerOutput> = (v) => onSave(v)   // v.seats: number
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <input {...register('name')} aria-invalid={!!errors.name} />
      {errors.name && <p role="alert">{errors.name.message}</p>}
      <input type="email" {...register('email')} />
      <input type="number" {...register('seats')} />
      <button disabled={isSubmitting}>Save</button>
    </form>
  )
}
// Or omit generics: useForm({ resolver: zodResolver(schema) }) infers <input, any, output> (verified).
// Server: const r = schema.safeParse(d); if (!r.success) z.flattenError(r.error) | z.treeifyError(r.error) | z.prettifyError(r.error)
```
Gotchas / breaking:
- **resolvers v5**: `zodResolver` returns `Resolver<z.input<T>, Ctx, z.output<T>>` (zod/v4/core overloads + zod/v3 overloads; peer `zod ^3.25 || ^4`, RHF `^7.55`). `useForm<z.infer<typeof s>>` (output-only) now **fails** when input≠output — tsc: `Resolver<{ n: unknown }, any, { n: number }> is not assignable to Resolver<{ n: number }, …>`. Use 3-generic form or inference. `raw: true` → submit gets input type.
- RHF 7.55+: 3rd generic `TTransformedValues` flows to `handleSubmit`. Present in 7.90: `<FormStateSubscribe>`/`<FormState>`, `<Watch>` (its `names` prop deprecated → `name`), `NestedValue` deprecated.
- **Zod 4**: `message` param `@deprecated … Use error` (`zod/v4/core/api.d.ts:9`); `invalid_type_error`/`required_error`/`errorMap` gone → `error: (iss) => …`. `z.string().email()/.url()/.uuid()` deprecated → `z.email()`, `z.url()`, `z.uuid()`. `err.flatten()`/`err.format()` `@deprecated` (`zod/v4/classic/errors.d.ts:7-12`) → `z.flattenError(err)`, `z.treeifyError(err)`; `z.prettifyError(err)` for text. `.passthrough()` deprecated → `z.looseObject()`/`.loose()` (`.strict()` still OK, or `z.strictObject`).

---

## 5. Editor, DnD, Email, Storage, Images — verified APIs (2026-10-16)
Verified against installed .d.ts/CHANGELOG in `scratchpad/libprobe` + runtime smoke test (Node 22.19). ⚠ = breaking vs older major.

### 5.1 TipTap 3 (3.32.0)
```tsx
'use client';
import { useEditor, useEditorState, EditorContent, type JSONContent } from '@tiptap/react'; // re-exports @tiptap/core
import { BubbleMenu } from '@tiptap/react/menus'; // ⚠ v3 subpath; needs @floating-ui/dom (optional peer)
import { StarterKit } from '@tiptap/starter-kit';  // named + default export

export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    codeBlock: false, code: false, horizontalRule: false, strike: false,
    undoRedo: {},                    // ⚠ was `history` in v2
    link: { openOnClick: false, autolink: true, defaultProtocol: 'https' }, // ⚠ Link now IN StarterKit
    underline: false,                // ⚠ Underline now IN StarterKit (disable if unwanted)
    // listKeymap, trailingNode, dropcursor, gapcursor also included; each `false` to disable
  }),
];

export function RichTextEditor({ value, onChange }: { value: JSONContent | null; onChange: (doc: JSONContent) => void }) {
  const editor = useEditor({
    immediatelyRender: false,            // required w/ SSR → return type `Editor | null`
    extensions: editorExtensions,
    content: value ?? '',
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    editorProps: { attributes: { class: 'prose min-h-48 focus:outline-none' } },
  });
  // ⚠ v3: shouldRerenderOnTransaction defaults false → toolbar state via useEditorState
  const s = useEditorState({
    editor,
    selector: ({ editor }) => ({ bold: editor?.isActive('bold') ?? false, h2: editor?.isActive('heading', { level: 2 }) ?? false }),
  });
  if (!editor) return null;
  return (
    <>
      <button type="button" aria-pressed={s?.bold} onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
      <BubbleMenu editor={editor} options={{ placement: 'top' }}>{/* ⚠ tippyOptions → options */}…</BubbleMenu>
      <EditorContent editor={editor} />
    </>
  );
}
// External reset: editor.commands.setContent(doc, { emitUpdate: false })  // ⚠ v2 was (content, emitUpdate, parseOptions)
```
StarterKit option keys (d.ts): `blockquote bold bulletList code codeBlock document dropcursor gapcursor hardBreak heading undoRedo horizontalRule italic listItem listKeymap link orderedList paragraph strike text underline trailingNode`. Link defaults: `openOnClick:true, autolink:true, linkOnPaste:true, defaultProtocol:'http', HTMLAttributes:{target:'_blank', rel:'noopener noreferrer nofollow'}`; use `isAllowedUri` to restrict schemes.

Other ⚠ v2→v3: `@tiptap/extension-list` (lists), `@tiptap/extensions` (Placeholder, CharacterCount, Focus, UndoRedo, Dropcursor, Gapcursor, TrailingNode); `setContent`/`clearContent` emit update by default; NodeView `getPos()` may return `undefined`; `editor.getCharacterCount()` removed; tippy.js → Floating UI; UMD builds gone.

**Server render stored JSON → HTML** (RSC / route handler):
```ts
import { generateHTML } from '@tiptap/html/server'; // explicit server entry; uses happy-dom
import { editorExtensions } from '@/lib/editor-extensions'; // keep extensions in a non-'use client' module
const html = generateHTML(doc, editorExtensions);  // sync string. Verified output:
// <h2>Hi</h2><p><a target="_blank" rel="noopener noreferrer nofollow" href="https://x.com">link</a><u> u</u></p>
```
- `@tiptap/html` root: `import.node` → server build, `browser`/default → DOM build that **throws** `"getHTMLFromFragment can only be used in a browser environment\nIf you want to use this in a Node environment, use the `@tiptap/html/server` import instead."` → always import `/server` on server.
- Output not sanitized beyond schema; schema drops unknown nodes/marks/attrs, but restrict link protocols via `isAllowedUri`.

**DOM-free alternative** `@tiptap/static-renderer` 3.32.0 (no happy-dom, no Editor instance; plugins/onCreate don't run):
```tsx
import { renderToReactElement } from '@tiptap/static-renderer/pm/react';
import { renderToHTMLString } from '@tiptap/static-renderer/pm/html-string';
export function RichText({ doc }: { doc: JSONContent }) {
  return <div className="prose">{renderToReactElement({ content: doc, extensions: editorExtensions })}</div>;
}
const html = renderToHTMLString({ content: doc, extensions: editorExtensions });
```
Recommend static-renderer `pm/react` for public RSC pages (no dangerouslySetInnerHTML, no DOM shim).

### 5.2 dnd-kit sortable (core 6.3.1 / sortable 10.0.0 / utilities 3.2.2 / modifiers 9.0.0)
```tsx
'use client';
import { useId } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type Announcements } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';

type Item = { id: string; label: string };

export function SortableList({ items, onReorder }: { items: Item[]; onReorder: (next: Item[]) => void }) {
  const dndId = useId(); // stable id → avoids aria-describedby="DndDescribedBy-N" hydration mismatch
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // clicks on inner buttons still work
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const label = (id: string | number) => items.find((i) => i.id === id)?.label ?? String(id);
  const announcements: Announcements = {   // all 4 keys required: onDragStart/onDragOver/onDragEnd/onDragCancel
    onDragStart: ({ active }) => `Picked up ${label(active.id)}.`,
    onDragOver: ({ active, over }) => over ? `${label(active.id)} over ${label(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) => over ? `${label(active.id)} dropped on ${label(over.id)}.` : `${label(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Reorder cancelled. ${label(active.id)} returned.`,
  };
  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    onReorder(arrayMove(items, from, to)); // persist sortOrder = index server-side
  }
  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      accessibility={{ announcements, screenReaderInstructions: { draggable: 'Press space to pick up. Arrow keys to move. Space to drop, Escape to cancel.' } }}
      onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul>{items.map((i) => <Row key={i.id} item={i} />)}</ul>
      </SortableContext>
    </DndContext>
  );
}

function Row({ item }: { item: Item }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}>
      <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Reorder ${item.label}`}>⠿</button>
      {item.label}
    </li>
  );
}
```
- Use `CSS.Translate` instead of `CSS.Transform` if rows have different heights (avoids scale stretch).
- Classic packages last published Dec 2024 but work w/ React 19 (peer `react >=16.8`). If `skipLibCheck:false`, core d.ts refs global `JSX.Element` — Next's default tsconfig has `skipLibCheck:true`.
- `@dnd-kit/react` + `@dnd-kit/helpers` exist (0.5.1, still pre-1.0, frequent beta builds, different API: `useSortable({id,index})`, `DragDropProvider`) → **don't use; stick w/ core+sortable**.

### 5.3 React Email → `react-email` 6.x (⚠ `@react-email/components` DEPRECATED)
`npm view @react-email/components deprecated` → `"Package no longer supported. Contact Support at https://www.npmjs.com/support for more info."` (same msg on `@react-email/html`, `/tailwind`, and other per-component pkgs). react-email 6.0.0 CHANGELOG: all components + render now exported from **`react-email`** (move from devDeps to `dependencies`). Only `@react-email/render` (2.1.0) and `@react-email/ui` stay maintained. react-email 6.11.2: engines `node >=20.19.0`, peers react/react-dom 18|19.
```tsx
// emails/contact-notification.tsx (server-only)
import { Html, Head, Preview, Body, Container, Heading, Text, Hr, Link, render, toPlainText } from 'react-email';
// (was: from '@react-email/components')

export function ContactNotification({ name, email, message }: { name: string; email: string; message: string }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>New enquiry from {name}</Preview>
      <Body style={{ fontFamily: 'Arial, sans-serif', background: '#f6f6f6' }}>
        <Container style={{ background: '#fff', padding: 24 }}>
          <Heading as="h2">New contact enquiry</Heading>
          <Text>{name} (<Link href={`mailto:${email}`}>{email}</Link>)</Text>
          <Hr />
          <Text style={{ whiteSpace: 'pre-wrap' }}>{message}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderContactEmail(p: Parameters<typeof ContactNotification>[0]) {
  const el = <ContactNotification {...p} />;
  const html = await render(el);                        // async → Promise<string>
  const text = await render(el, { plainText: true });   // or toPlainText(html) (sync)
  return { html, text };
}
```
`render(node, { pretty?, plainText?, htmlToTextOptions?, unstableTextConversion? })`. Verified: plainText → `"Hello\n\ngo https://x.com"`. Note: `react-email` pkg also carries CLI deps (esbuild, socket.io, tailwindcss) — only import from server code.

### 5.4 nodemailer 10.1.1 (bundled TS types)
```ts
import 'server-only';
import nodemailer, { type Transporter, type SendMailOptions } from 'nodemailer';
import type { SMTPSentMessageInfo, SMTPTransportOptions, NodemailerError } from 'nodemailer';

export function createMailer(cfg: { host: string; port: number; user: string; pass: string }) {
  const opts: SMTPTransportOptions = {
    host: cfg.host, port: cfg.port,
    secure: cfg.port === 465,           // true = implicit TLS (465); false = STARTTLS (587)
    requireTLS: cfg.port === 587,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
  };
  return nodemailer.createTransport(opts); // Mail<SMTPSentMessageInfo, SMTPTransportOptions>
}

export async function testSmtp(t: ReturnType<typeof createMailer>) {
  try { await t.verify(); return { ok: true as const }; }   // Promise<true>
  catch (e) { const err = e as NodemailerError; return { ok: false as const, code: err.code, message: err.message }; }
}

const info: SMTPSentMessageInfo = await transporter.sendMail({
  from: '"Security Partners" <no-reply@example.ie>', to, replyTo: visitorEmail,
  subject: 'New enquiry', html, text,
} satisfies SendMailOptions);
// info.messageId, info.accepted, info.rejected, info.response
```
⚠ Breaking by major: **v7** SES transport = SESv2 SDK only (old SES v2/v3 removed, rate-limit/idling removed). **v8** error code `'NoAuth'` → `'ENOAUTH'` (codes centralized: EAUTH, ECONNECTION, ETIMEDOUT, ETLS, EENVELOPE, …). **v9** HTTPS fetches of remote content (attachment `href`/`path` URLs, OAuth2, proxy CONNECT) now validate TLS certs by default. **v10** Node ≥20 required; rewritten in TS, ESM (`"type":"module"`) + CJS dual build, `exports` map added (only `nodemailer/lib/*` subpaths exported; deep imports into old `lib/` paths break if not listed). Types bundled & keep `@types/nodemailer` layout (`import SMTPTransport from 'nodemailer/lib/smtp-transport'; SMTPTransport.Options` still resolves) → **remove `@types/nodemailer`** (8.0.2 still on npm; avoid dup/conflicting types). 9.1: `maxRecipients` option.

### 5.5 S3 client → Cloudflare R2 (@aws-sdk/client-s3 3.1152.0, engines node ≥20)
```ts
import 'server-only';
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand, GetObjectCommand, S3ServiceException } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'; // optional, same version line

export function r2Client(c: { accountId: string; accessKeyId: string; secretAccessKey: string }) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${c.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
    requestChecksumCalculation: 'WHEN_REQUIRED',  // see note
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

await s3.send(new PutObjectCommand({
  Bucket: bucket, Key: `media/${id}.webp`, Body: buffer, ContentType: 'image/webp',
  CacheControl: 'public, max-age=31536000, immutable', ContentLength: buffer.length,
}));
await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })); // 204 even if key missing

export async function testR2(s3: S3Client, bucket: string) {
  try { await s3.send(new HeadBucketCommand({ Bucket: bucket })); return { ok: true }; }
  catch (e) {
    if (e instanceof S3ServiceException) {
      const status = e.$metadata.httpStatusCode; // 403 bad creds/perm, 404 bucket missing
      return { ok: false, status, code: e.name, message: status === 404 ? 'Bucket not found' : status === 403 ? 'Access denied' : e.message };
    }
    return { ok: false, message: (e as Error).message }; // DNS/endpoint errors (bad accountId)
  }
}
const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 3600 });
```
- Checksum flag: SDK default still `WHEN_SUPPORTED` for both (verified `DEFAULT_REQUEST_CHECKSUM_CALCULATION = "WHEN_SUPPORTED"` in `@aws-sdk/checksums` 3.1001.3) → SDK adds CRC32 on PutObject. Cloudflare's current R2 S3-API page now lists CRC32/CRC32C/SHA1/SHA256 (COMPOSITE) + CRC64NVME (FULL_OBJECT), and the R2 aws-sdk-js-v3 example no longer mentions the flag. Still recommend `'WHEN_REQUIRED'`: harmless; avoids `x-amz-checksum-*`/`x-amz-sdk-checksum-algorithm` (marked unimplemented on several R2 ops, e.g. CopyObject, PutBucketCors) and checksum query params baked into presigned PUT URLs that browser uploads can't satisfy. Field reports of R2 "We encountered an internal error" fixed by this setting.
- Errors also typed: `NoSuchKey`, `NoSuchBucket`, `NotFound` (HeadBucket 404 surfaces as `NotFound`/name `NotFound`).
- Presigned PUT for browser uploads requires bucket CORS rule + client sending matching `Content-Type`.

### 5.6 sharp 0.35.5 (libvips 8.18.x)
```ts
import 'server-only';
import sharp from 'sharp'; // 0.35 adds native ESM entry (dist/index.mjs) + CJS

export async function processUpload(input: Buffer) {
  const img = sharp(input, { limitInputPixels: 40_000_000 }).autoOrient(); // honour EXIF before resize
  const meta = await sharp(input).metadata();
  // meta.format ('jpeg'|'png'|'webp'|'heif'…), meta.width, meta.height (raw, pre-EXIF),
  // meta.autoOrient.{width,height} (post-EXIF), meta.mediaType ('image/png') ← new in 0.35
  const { width, height } = meta.autoOrient;

  const webp = await img.clone().resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  const avif = await img.clone().resize({ width: 1920, withoutEnlargement: true }).avif({ quality: 50 }).toBuffer();
  // ⚠ avif toBuffer({resolveWithObject:true}).info.format === 'heif'

  const tiny = await img.clone().resize(16, 16, { fit: 'inside' }).webp({ quality: 40 }).toBuffer();
  const blurDataURL = `data:image/webp;base64,${tiny.toString('base64')}`; // ~60–150 bytes, use w/ next/image placeholder="blur"
  return { width, height, webp, avif, blurDataURL };
}
```
⚠ **0.35.0** breaking: Node ≥20.9.0 (Node 18 dropped); `install` script removed (no prebuilt → WebAssembly `@img/sharp-wasm32` or build from source manually — matters for Docker: install on target platform/arch, e.g. `pnpm install --os=linux --cpu=x64` or build inside image); lossy AVIF now tuned w/ SSIMULACRA2 `iq` metric (new `tune` option: `'auto'|'iq'|'psnr'|'ssim'`) → file sizes/quality differ from 0.34 at same `quality`; new `limitInputChannels` default 5; removed `failOnError` ctor option (use `failOn`); removed `metadata().paletteBitDepth`; removed deprecated `sharpen` props (use `{sigma, m1, m2, x1, y2, y3}`); `format.jp2k` → `format.jp2`. Adds `mediaType` in metadata, `toUint8Array()`, `trim({margin})`, WebP `exact`, ESM.
⚠ **0.34.0** added `autoOrient()` and `metadata().autoOrient`, which replace a bare `rotate()` for EXIF orientation.
- Next.js 16 built-in `server-external-packages.jsonc` includes `sharp` + `@aws-sdk/client-s3` (verified); `nodemailer`, `happy-dom`, `react-email` are NOT in list → add to `serverExternalPackages` only if bundling errors appear. All of these: Node runtime only (not edge).

---

## 6. Testing & AI stack (verified vs installed d.ts/docs, 2026-10-16)
Installed: vitest 5.0.5 (peer vite 8.3.4), @playwright/test 1.64.1, ai 7.0.142, @ai-sdk/anthropic 4.0.81,
@ai-sdk/openai 4.0.95, @ai-sdk/provider 4.0.28, uuidv7 1.2.1. npm also has @ai-sdk/google 4.0.97 and
@ai-sdk/openai-compatible **3.0.70** (major 3 but depends on @ai-sdk/provider 4.0.28 → works w/ ai 7).
@ai-sdk/react 4.0.146.

### 6.1 Vitest 5
Deps: `pnpm add -D vitest vite happy-dom` — **vite is now a required peer** (no longer a vitest dep; pnpm strict → must list it).
Node `^22.12.0 || ^24 || >=26`. No `vite-tsconfig-paths` needed: Vite 8 has native `resolve.tsconfigPaths` (default `false`).

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => ({
  resolve: {
    tsconfigPaths: true, // Vite 8 native; replaces vite-tsconfig-paths
    alias: {
      // `server-only` throws outside react-server condition → stub it
      'server-only': fileURLToPath(new URL('./test/stubs/empty.ts', import.meta.url)),
    },
  },
  test: {
    // root-level opts are INHERITED by inline projects in v5 (extends defaults true; arrays like setupFiles APPEND)
    env: loadEnv(mode, process.cwd(), ''), // '' prefix = load all vars from .env, .env.test, .env.test.local
    clearMocks: true, // v5 default already true (was false) – explicit for clarity
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node', // or 'happy-dom' / 'jsdom' for component tests
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
          exclude: ['src/**/*.int.test.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['src/**/*.int.test.ts'],
          setupFiles: ['./test/setup.int.ts'],
          globalSetup: ['./test/global-setup.int.ts'], // e.g. migrate test DB once
          testTimeout: 30_000,
          hookTimeout: 60_000,
          fileParallelism: false, // forces maxWorkers=1 (shared DB)
          // pool: 'forks' is the default; `poolOptions` NO LONGER EXISTS (removed in v4)
          // old singleFork ≙ `maxWorkers: 1, isolate: false`
        },
      },
    ],
  },
}));
```
```ts
// test/stubs/empty.ts
export {};
// alt per-file: vi.mock('server-only', () => ({}))  – v5: vi.mock MUST be top-level or it throws
```
Run: `vitest --project unit`, `vitest run --project integration`. Env alt: `import { loadEnvConfig } from '@next/env'; loadEnvConfig(process.cwd())` in setupFiles (matches Next's .env precedence exactly).

**Breaking v3 → v4**: `workspace` → `projects`. `poolOptions` was removed and its keys moved to the top level: `maxThreads`/`maxForks` → `maxWorkers`, `singleFork` → `maxWorkers:1, isolate:false`, and `minWorkers` is gone. Coverage dropped `all`/`extensions` (set `coverage.include`). `deps.inline` → `server.deps.inline`. `environmentMatchGlobs`/`poolMatchGlobs` were removed in favour of projects. The default exclude is now only `node_modules` and `.git`. The browser provider is an object (`@vitest/browser-playwright`). `restoreMocks` now restores only `vi.spyOn` spies.

**Breaking v4 → v5** (vitest.dev/guide/migration):
- Vite `>=6.4` (peer, must be installed), Node `>=22.12`.
- `clearMocks` default **true**. Inline projects `extends` default **true** (inherit root; arrays append) → set `extends:false` to isolate. `sharedViteServer` default true.
- `vi.mock`/`vi.unmock`/`vi.hoisted` must be top-level (throw otherwise). `test.sequential`/`describe.sequential` removed → `concurrent:false`.
- `expect.poll` rejects on timeout; unawaited `resolves`/`rejects`/`toMatchFileSnapshot` fail test; `toThrow("")` matches any.
- Fake timers mock `Temporal` (opt out `toNotFake:['Temporal']`).
- Reporters write to `.vitest/`; `json`/`junit` write files by default; html `outputFile` → `outputDir`.
- `coverage.include/exclude` root-relative; `thresholds.perFile` not inherited by globs.
- `bench` no longer top-level import (fixture). Removed entry points: `vitest/coverage`, `vitest/reporters`, `vitest/environments`, `vitest/snapshot`, `vitest/runners`, `vitest/suite`, `vitest/mocker`.
- Browser: `browser.api`/`browser.isolate` deprecated; `toHaveTextContent` exact (use `toMatchTextContent`).

### 6.2 Playwright 1.64
```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}', // no {platform} → share across OS only if CI is Linux-only
  expect: {
    toHaveScreenshot: {
      animations: 'disabled', // 'allow' | 'disabled'
      caret: 'hide',          // 'hide' | 'initial'
      scale: 'css',           // 'css' | 'device'
      maxDiffPixels: 0,
      // threshold: 0.2 (YIQ default), maxDiffPixelRatio, stylePath: './e2e/screenshot.css', type: 'png'|'webp' (1.64)
    },
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry', // or { mode, snapshots: { dom, aria, screen } } (1.63)
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`, // prod build = stable screenshots
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000, // default 60_000
    env: { NODE_ENV: 'production', DATABASE_URL: process.env.E2E_DATABASE_URL ?? '' }, // Record<string,string>
    stdout: 'pipe', // default 'ignore'
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 }, // default SIGKILL
    // wait: { stdout: /Ready in/ }  (1.57; named capture groups → process.env)
  },
});
```
Newer options worth knowing (verified in 1.64 d.ts): project `default: false` (excluded from plain run unless `--project` or a dependency) (1.64);
`retryStrategy: 'immediate'|'isolated'` (1.62); `updateSnapshots: 'all'|'changed'|'missing'|'none'|'default'` (1.64 renamed default mode → `'default'`; `missing` now passes);
`captureGitInfo`, `tag` (1.57), `failOnFlakyTests`, `respectGitIgnore`, `expect.toMatchAriaSnapshot.{pathTemplate,children}`.
Breaking 1.64: `screen` now from device descriptors. 1.57: Chromium headless = `chrome-headless-shell` (Chrome for Testing) → **rebaseline screenshots** if upgrading across it.
Run screenshots in the official Docker image (`mcr.microsoft.com/playwright:v1.64.1-noble`) for deterministic fonts.

### 6.3 AI SDK 7 (`ai` 7.0.142)
ESM-only, Node >=22, spec `LanguageModelV4` (`specificationVersion: 'v4'`); `LanguageModel = GlobalProviderModelId | LanguageModelV4 | V3 | V2`.
⚠ a plain **string** model id is valid `LanguageModel` → routed via Vercel AI Gateway (`AI_GATEWAY_API_KEY`). Always pass a provider instance.

```ts
// src/server/ai/model.ts
import 'server-only';
import type { LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
// import { createGoogle } from '@ai-sdk/google';            // v7 name (createGoogleGenerativeAI = deprecated alias)
// import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export type AiProvider = 'anthropic' | 'openai';

export function getModel(provider: AiProvider, apiKey: string, modelId: string): LanguageModel {
  switch (provider) {
    case 'anthropic':
      return createAnthropic({ apiKey })(modelId); // settings: apiKey, authToken, baseURL, headers, fetch, name
    case 'openai':
      return createOpenAI({ apiKey })(modelId);    // default = Responses API; .chat(id) for Chat Completions
    default: {
      const _x: never = provider;
      throw new Error(`unknown provider ${String(_x)}`);
    }
  }
}
```
```ts
// app/api/chat/route.ts (streaming)
import { streamText, convertToModelMessages, toUIMessageStream, createUIMessageStreamResponse, type UIMessage } from 'ai';
import type { AnthropicLanguageModelOptions } from '@ai-sdk/anthropic';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const result = streamText({
    model: getModel('anthropic', key, 'claude-sonnet-4-5'),
    instructions: 'You are…',                          // v7: `system` → `instructions` (system = deprecated fallback)
    messages: await convertToModelMessages(messages),   // async since v6; `prompt: string` alternative
    maxOutputTokens: 1024,                              // v5 rename of maxTokens
    temperature: 0.3,
    maxRetries: 2,
    timeout: { totalMs: 60_000, chunkMs: 15_000 },      // number | {totalMs,stepMs,firstChunkMs,chunkMs,toolMs}
    abortSignal: req.signal,
    providerOptions: { anthropic: { /* … */ } satisfies AnthropicLanguageModelOptions },
    onError: ({ error }) => console.error(error),       // stream errors DON'T throw; may return { retry: true }
    onEnd: ({ text, usage, finalStep }) => { /* persist */ }, // v7: onFinish → onEnd (alias kept)
  });
  return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream, originalMessages: messages }) });
  // deprecated-but-working: result.toUIMessageStreamResponse(), result.toTextStreamResponse()
  // plain text: createTextStreamResponse({ stream: toTextStream({ stream: result.stream }) })
}
```
```ts
// structured output (generateObject/streamObject deprecated since v6, still exported in v7)
import { generateText, Output, APICallError, RetryError, NoOutputGeneratedError } from 'ai';
try {
  const { output, usage } = await generateText({ model, instructions, prompt, output: Output.object({ schema: zodSchema }) });
} catch (e) {
  if (RetryError.isInstance(e)) e = e.lastError;          // after maxRetries: reason, lastError, errors[]
  if (APICallError.isInstance(e)) { e.statusCode; e.isRetryable; e.responseBody; } // 401 = bad user key
  if (NoOutputGeneratedError.isInstance(e)) { /* schema parse fail */ }
}
```
Other error classes exported: `AISDKError`, `LoadAPIKeyError` (missing key), `InvalidPromptError`, `NoSuchModelError`, `TypeValidationError`, `NoObjectGeneratedError`, `UnsupportedFunctionalityError`.

**Breaking v4 → v5**: `maxTokens`→`maxOutputTokens`, `CoreMessage`→`ModelMessage`, `Message`→`UIMessage` (`parts[]`), `convertToCoreMessages`→`convertToModelMessages`, `maxSteps`→`stopWhen`, tool `parameters`→`inputSchema`, `toDataStreamResponse`→`toUIMessageStreamResponse`. `ai/react` moved to `@ai-sdk/react` (`append`→`sendMessage`). OpenAI defaults to the Responses API.
**v5 → v6**: `CoreMessage` was removed. `generateObject`/`streamObject` are deprecated in favour of `output: Output.object()`. `convertToModelMessages` is now async. `Experimental_Agent`→`ToolLoopAgent`. The provider spec is LanguageModelV3.
**v6 → v7**: ESM-only, Node 22+; `system`→`instructions`; system messages in `messages` **rejected** unless `allowSystemInMessages: true`;
`onFinish`→`onEnd`, `onStepFinish`→`onStepEnd`, `experimental_onStart`→`onStart`; `fullStream`→`stream`; `stepCountIs`→`isStepCount`;
`result.usage` = all steps (`totalUsage` deprecated, `finalStep.usage` = last); `toolCalls/content/…` accumulate all steps; `reasoning/request/response/providerMetadata` → `finalStep.*`;
`experimental_output` removed → `output`; `experimental_telemetry`→`telemetry` (OTel → `@ai-sdk/otel`); request/response bodies excluded by default (`include: { requestBody: true }`);
stream response methods on result deprecated → stateless `toUIMessageStream`/`createUIMessageStreamResponse`/`toTextStream`/`createTextStreamResponse`;
usage `cachedInputTokens`/`reasoningTokens` removed → `inputTokenDetails.cacheReadTokens`/`outputTokenDetails.reasoningTokens`; `CallSettings` → `LanguageModelCallOptions & RequestOptions`;
Google `createGoogleGenerativeAI`→`createGoogle`; OpenAI reasoning summary defaults `'detailed'`; LanguageModelV4. Codemods: `npx @ai-sdk/codemod v7`.

### 6.4 uuidv7
```ts
import { uuidv7, uuidv7obj } from 'uuidv7'; // ESM + CJS; also exports uuidv4, UUID, V7Generator
const id = uuidv7();          // '01a14138-2b64-7a1b-a5f1-3b5ec0be2cc4' (monotonic within same ms)
uuidv7obj().getVersion();     // 7
```
For Drizzle, use `$defaultFn(() => uuidv7())` (portable) or `.default(sql\`uuidv7()\`)` (Postgres 18 or newer).
Native alternatives: **Postgres 18** ships built-in `uuidv7()` (+ `uuidv4()` alias of `gen_random_uuid()`; `uuid_extract_timestamp()` works on v7). PG ≤17: no builtin (use app-side / `pg_uuidv7` ext).
Node: `crypto.randomUUID()` is v4 only — no v7 in `node:crypto` (checked Node 22.19). Bun has `Bun.randomUUIDv7()` (n/a here).
