# Next.js 16.3.8 API reference (App Router, Cache Components)

Installed: `node_modules/next/package.json` → `"version": "16.3.8"` (React 19.3.0).
Sources: `node_modules/next/dist/docs/01-app/**` plus spot checks of `node_modules/next/dist/server/**`.
Lines marked **[src]** were verified in the Next source, not the docs. Lines marked **[inference]** are our design conclusions; they are not stated in the docs.

Requirements: Node >= 20.9, TS >= 5.1. Turbopack is the default bundler for dev and build.

---

## 0. TL;DR rules for implementers

1. `cacheComponents: true` → everything is **dynamic by default**. Nothing is cached unless you add `'use cache'`.
2. `next build` **prerenders every route** and runs `'use cache'` functions at build time. Anything that reaches the DB during prerender will run against the DB during the build.
3. To keep the DB out of the build, every DB-reading component sits inside `<Suspense>` and calls `await connection()` **before** the DB call. `connection()` must be called outside the `'use cache'` function, because it throws inside one.
4. Reading `cookies()`, `headers()`, `searchParams`, or `params`, or uncached I/O, outside `<Suspense>` fails the build with `Route "...": Next.js encountered uncached or runtime data during prerendering.`
5. Under Cache Components, `export const dynamic | revalidate | fetchCache | dynamicParams` **fail the build**. `runtime = 'edge'` is unsupported. `runtime = 'nodejs'` and `maxDuration` are still allowed.
6. `revalidateTag(tag, profile)`: the 2nd arg is **required** (the 1-arg form is deprecated). `updateTag(tag)` works only in **Server Actions**.
7. `revalidateTag` / `updateTag` throw outside a request context, e.g. from a `setInterval` in `instrumentation.ts` **[src]**.
8. Middleware is renamed: the file is `proxy.ts` and the export is `proxy`. It always runs on Node; `runtime` can't be configured.
9. `params`, `searchParams`, `cookies()`, `headers()`, and `draftMode()` are **async only**. Sync access was removed in 16.

---

## 1. `next.config.ts`

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  cacheComponents: true, // replaces experimental.dynamicIO / useCache / ppr (all removed)
  cacheLife: {
    // custom profile; omitted fields inherit from 'default'
    content: { stale: 300, revalidate: 3600, expire: 86400 }, // seconds; expire must be > revalidate
  },
  experimental: {
    globalNotFound: true, // needed for app/global-not-found.tsx (multiple root layouts)
    authInterrupts: true, // only if we use unauthorized()/forbidden()
    // serverActions: { bodySizeLimit: '2mb' },   // Server Action body default 1MB
    // proxyClientMaxBodySize: '10mb',            // body buffering when proxy matches; default 10MB
  },
  images: {
    // see §9
  },
}
export default nextConfig
```

- `cacheComponents` requires the Node.js runtime.
- It also turns on PPR (static shell + streamed holes) and React `<Activity>` route preservation. Component state, form inputs, and `useActionState` results now **persist** across back/forward navigations. Reset them explicitly if a flow depends on unmounting.
- `next.config` is read at **build** and serialized into the standalone `server.js`. Treat `images`, `cacheLife`, and similar settings as build-time.

---

## 2. Caching APIs

All of these are imported from `next/cache`: `cacheLife`, `cacheTag`, `revalidateTag`, `updateTag`, `revalidatePath`, `refresh`, `io`.
`connection` and `after` are imported from `next/server`.

### 2.1 `'use cache'`

- The directive can go at the file level, the function level, or the component level. The function **must be async**.
- A file-level `'use cache'` makes every export cached, so each export must be async. That includes `generateMetadata` and `generateStaticParams` when they live in that file.

```ts
// lib/data/posts.ts
import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'

export async function getPostBySlug(slug: string) {
  'use cache'
  cacheLife('content')        // always set one explicitly
  cacheTag('posts', `post:${slug}`)
  return db.query.posts.findFirst({ where: eq(posts.slug, slug) })
}
```

**Cache keys**
- The key is made of the build ID (or `deploymentId`), the function ID, and the serialized arguments, including closure-captured variables.
- Keys and tags are stored in **plain text**. Never put tokens or emails in arguments or tags.

**Serialization**
- Arguments can be primitives, plain objects, arrays, Date, Map, Set, or TypedArrays. Class instances, URL, Symbols, and functions are not allowed (pass-through `children` and actions are OK if they are not introspected).
- Return values can be the same types, plus JSX.
- **[inference]** If a Drizzle or Prisma row contains class instances (Decimal, for example), map it to plain objects.

**Forbidden inside a cache scope**
- `cookies()`, `headers()`, and `searchParams` → error `next-request-in-use-cache`. The check follows the call stack into helpers.
- On a dynamic route this can pass `next build` and **fail only under `next start`**.
- Read those values outside the scope and pass them in as arguments.

**Also throws inside a cache scope [src]:** `connection()`, `revalidateTag`, `updateTag`, `draftMode().enable()` and `.disable()`.

**Allowed inside a cache scope:** `(await draftMode()).isEnabled`. Inside a cache scope, `io()` is a no-op.

**`React.cache` is isolated** inside `'use cache'`. Values set outside are not visible inside.

**Storage**
- Storage is an in-memory LRU per process. On a self-hosted single instance it persists across requests.
- It does **not** survive a redeploy (the key includes the build ID). Size is controlled by `cacheMaxMemorySize`.
- For multiple instances you need `'use cache: remote'` plus `cacheHandlers`. Without that, `revalidateTag` only invalidates the instance that received it.

**Build hang**
- If a Promise of runtime data is passed into a cached function, the build fails after 50s with: `Error: Filling a cache during prerender timed out, likely because request-specific arguments such as params, searchParams, cookies() or uncached data were used inside "use cache".`

**Debugging:** run with `NEXT_PRIVATE_DEBUG_CACHE=1`.

### 2.2 `cacheLife(profile)`

- It must be called **inside** a cache scope. Calling it at module scope throws.
- Only one call should execute per invocation; conditional branches are fine.
- Signature: `cacheLife(profile: string | { stale?: number; revalidate?: number; expire?: number })`, all values in seconds.

| profile | stale | revalidate | expire |
|---|---|---|---|
| `default` (used when `cacheLife` is omitted) | 5m | 15m | never |
| `seconds` | 30s | 1s | 1m |
| `minutes` | 5m | 1m | 1h |
| `hours` | 5m | 1h | 1d |
| `days` | 5m | 1d | 1w |
| `weeks` | 5m | 1w | 30d |
| `max` | 5m | 30d | 1y |

**Prerender thresholds**
- An entry is excluded from the prerender (becomes a "dynamic hole" resolved at request time) if `revalidate: 0`, `expire < 5min`, or `stale < 30s`. Of the presets, only `seconds` does this.
- A short-lived inner cache nested in an outer `'use cache'` that has **no explicit** `cacheLife` → build **error** during prerender. Always set `cacheLife` in the outer scope.

### 2.3 `cacheTag(...tags: string[])`

- Call it only inside a cache scope.
- Up to 128 tags per call, each at most 256 characters. Longer tags are skipped and extra tags dropped, with a console warning.
- Tags are case-sensitive and idempotent.

### 2.4 `revalidateTag(tag, profile)`, the current signature

```ts
revalidateTag(tag: string, profile: string | { expire?: number }): void
```

- `'max'` (recommended): stale-while-revalidate. The next request gets stale content while a refresh runs in the background.
- `{ expire: 0 }`: the next request blocks and gets fresh data. Use this for read-your-writes from a **Route Handler** (`updateTag` is not available there).
- 1-arg `revalidateTag(tag)`: **deprecated**. It is a TS error and behaves like `{ expire: 0 }`.
- Revalidation is triggered lazily by the next request, not by the call itself.
- It is callable in **Server Actions and Route Handlers** (including our Hono catch-all). It is **not** callable in Proxy, Client Components, or during render.
- Calling it with no request store throws `Invariant: static generation store missing in revalidateTag` **[src]**.

```ts
// inside Hono handler running in app/api/[...route]/route.ts
import { revalidateTag } from 'next/cache'
await db.update(posts).set(data).where(eq(posts.id, id))
revalidateTag(`post:${slug}`, { expire: 0 }) // admin sees own write immediately
revalidateTag('posts', 'max')                // listings: SWR is fine
```

### 2.5 `updateTag(tag)`

- Signature: `updateTag(tag: string): void`. It expires the tag immediately, and the next request waits for fresh data.
- It works **only in Server Actions**. Anywhere else it throws `updateTag can only be called from within a Server Action`.
- Calling `revalidateTag`, `revalidatePath`, `updateTag`, or `refresh` **from a Server Action** also clears the entire client router cache.

### 2.6 Other cache functions

- `revalidatePath(path: string, type?: 'page' | 'layout')`. `type` is required when `path` contains a dynamic segment such as `/blog/[slug]`.
- `refresh(): void` re-renders the current route without touching the cache. Server Actions only.

### 2.7 `connection()` and `io()`

```ts
import { connection } from 'next/server' // (): Promise<void>
import { io } from 'next/cache'          // (): Promise<void>, new in 16.3
```

**`connection()`**
- During prerender it suspends forever. At request time it resolves.
- It blocks prefetch and does not work in `'use cache'`, `'use cache: private'`, `generateStaticParams`, or inside `after()` while rendering.
- It replaces `unstable_noStore`.
- **Use it to keep the DB and env reads out of the build.**

**`io()`**
- It suspends during prerender, but code after it **can** be cached and prefetched.
- It resolves immediately at request time, inside cache scopes, and in `generateStaticParams`.
- Docs prefer `io()` over `connection()` for `new Date()` and `Math.random()`.
- **[inference]** For "no DB at build" use `connection()`. With `io()`, a `'use cache'` call that follows could still be pulled into prefetch or prerender-runtime renders.

### 2.8 Where each API is callable

| API | Server Component render | Server Action | Route Handler (Hono) | Proxy | `instrumentation` timer |
|---|---|---|---|---|---|
| `'use cache'` fn call | yes | yes | yes (helper fn only; directive not on `GET` itself) | n/a | **[inference]** works but no request store |
| `cacheTag` / `cacheLife` | only inside cache scope | same | same | no | no |
| `revalidateTag(tag, p)` | **no** (throws during render) | yes | yes | no | **no (throws) [src]** |
| `updateTag` | no | **yes only** | no (throws) | no | no |
| `revalidatePath` | no | yes | yes | no | no |
| `refresh` | no | yes only | no | no | no |
| `connection()` | yes | n/a | yes (stops GET prerender) | n/a | no |
| `cookies()` / `headers()` | yes (in Suspense) | yes (`cookies().set` ok) | yes | use `request.cookies` | no |
| `draftMode().enable()` | no | yes | yes | no | no |

**[inference]** For time-based publishing, the scheduler must not call `revalidateTag` directly. Have it hit an internal secret-protected Route Handler such as `POST /api/internal/revalidate` over `fetch('http://127.0.0.1:' + PORT + ...)`, which then calls `revalidateTag`. Alternatively, rely on a short `cacheLife` for listings.

---

## 3. Dynamic data under Cache Components and building with no `DATABASE_URL`

### 3.1 What prerender does with each kind of code

- `'use cache'` code **runs at build** and its output goes into the static shell.
- `<Suspense>` puts its fallback into the shell; the children stream at request time.
- Uncached async I/O inside Suspense (fetch, DB) **is still started during prerender**. Docs: "the `fetch` runs during prerendering, so point it at a working endpoint".
- Request-time APIs (`cookies`, `headers`, `searchParams`, `params` for unknown values, `connection()`) suspend the prerender at that point.
- `new Date()`, `Date.now()`, `Math.random()`, and `crypto.randomUUID()` in a prerendered path → **build error**. `instant = false` does not clear this. Fix with `await connection()` (or `io()`) first inside Suspense, or wrap in `'use cache'`.
- Module-scope code and sync I/O (`readFileSync`, `node:sqlite`) are "predictable" and run at build.
- `draftMode()` during prerender resolves to `isEnabled: false` **without suspending**, so it does not make a route dynamic **[src]**.

### 3.2 Build error text

```
Error: Route "/products/[id]": Next.js encountered uncached or runtime data during prerendering.
`fetch(...)`, `cookies()`, `headers()`, `params`, `searchParams`, or `connection()` accessed outside of `<Suspense>` prevents the route from being prerendered, ...
Ways to fix this:
  - [stream] Provide a placeholder with `<Suspense fallback={...}>` around the data access
  - [cache] For uncached data (`fetch`, database calls): cache the access with "use cache" (does not apply to `connection()`)
  - [block] Set `export const instant = false` to allow a blocking route
```

- Debug the stack with `next build --debug-prerender`. Never deploy that output.
- Scope a build with `next build --debug-build-paths="app/(site)/blog/[slug]/page.tsx"`.

### 3.3 Canonical pattern for a DB-backed page with no DB at build **[inference built from the documented rules]**

```tsx
// app/(site)/blog/[slug]/page.tsx
import { Suspense } from 'react'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { getPostBySlug } from '@/lib/data/posts' // 'use cache' + cacheTag inside

export default function Page({ params }: PageProps<'/blog/[slug]'>) {
  // do NOT await params here; pass the promise down
  return (
    <Suspense fallback={<PostSkeleton />}>
      <Post params={params} />
    </Suspense>
  )
}

async function Post({ params }: Pick<PageProps<'/blog/[slug]'>, 'params'>) {
  await connection()               // prerender stops here → DB never touched at build
  const { slug } = await params
  const post = await getPostBySlug(slug) // cached at runtime (in-memory), tagged
  if (!post) notFound()
  return <Article post={post} />
}
```

**Rules**
- The DB client must be **lazy**. Don't throw at import when `DATABASE_URL` is missing, because modules are imported during build ("Collecting page data"). **[inference]**
- **Omit `generateStaticParams`** on DB routes. Without it, the route renders per request (`'use cache'` still caches the data).
- If `generateStaticParams` **is** exported under cacheComponents, it **must return >= 1 param**. `[]` → build error `empty-generate-static-params`. It also runs at build, so it would need the DB.
- `export const dynamicParams` → build error: `Route segment config "dynamicParams" is not compatible with nextConfig.cacheComponents.` Unknown params always render on request; use `notFound()` for missing data.
- Static parts outside Suspense (header, hero copy) still prerender.
- Shared layouts that need DB data (nav, footer settings) must also put that data behind `<Suspense>` + `connection()`.
- Root layouts must never `await` request data at top level, because there is no parent boundary to fall back to.
- Client hooks `usePathname`, `useParams`, `useSelectedLayoutSegment(s)` suspend under dynamic params, so wrap the component that uses them in `<Suspense>`. `useSearchParams` **always** needs `<Suspense>`.
- A cookie or header that drives `<html>` attributes (theme, lang) → use an inline `<head>` script instead (next-themes already does this).
- Validation insights in dev (`blocking-route`, `blocking-prerender-*`) appear only in the overlay or log. The page still returns 200.
- `export const instant = false` on a segment silences dev validation and the non-empty-shell check. It does **not** force dynamic rendering and does **not** fix build errors from sync IO.

### 3.4 `cookies()` / `headers()` (`next/headers`), async only

```tsx
async function Greeting() {             // must be rendered inside <Suspense>
  const theme = (await cookies()).get('theme')?.value
  return <CachedPart theme={theme} />   // pass the VALUE into 'use cache', never the promise
}
```

- `'use cache: private'` may read `cookies()`, `headers()`, and `searchParams` directly. Its results are stored in the browser only, never on the server.

### 3.5 Session and auth pattern (from the authentication-with-cache-components guide)

- Read the session in a component inside `<Suspense>`. A cookie read outside a boundary is a build error.
- Never read the session in a layout's top level.
- Pass `userId` into a plain `'use cache'` function; keep that cached function **unexported**.
- In Server Actions, re-read the session. Then `updateTag(\`notes:${userId}\`)`.
- Proxy is **not** a security boundary. Server Function POSTs go to the page route, and a matcher change silently drops coverage. Authorize inside every action and handler.

---

## 4. `draftMode()` (`next/headers`)

```ts
const draft = await draftMode()   // { isEnabled: boolean; enable(): void; disable(): void }
```

- `enable()` and `disable()` work only in **Route Handlers or Server Actions**. They throw inside a cache scope or inside `after()`.
- `enable()` sets the `__prerender_bypass` cookie. Its value changes every `next build`. The session ends when the browser closes.
- **Draft mode bypasses caches automatically.** For a request with the cookie:
  - every `'use cache'` function re-executes and is not saved,
  - `fetch` skips the data cache,
  - the ISR/prerender cache is skipped,
  - the response gets `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`.
- No code changes are needed in data functions. To branch draft vs. published data, read `(await draftMode()).isEnabled`; this is allowed inside `'use cache'`.
- During build or prerender, `isEnabled` is `false`.
- To exit, use a Server Action or POST, or a `<form method="GET">`. Never use `<Link>` to the disable route, because prefetch would clear the cookie.

```ts
// app/api/draft/route.ts  (if outside Hono; inside Hono the same calls work in the handler)
import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('secret') !== process.env.PREVIEW_SECRET) return new Response('Invalid', { status: 401 })
  ;(await draftMode()).enable()
  redirect(searchParams.get('slug') ?? '/')
}
```

---

## 5. `proxy.ts` (replaces `middleware.ts`)

- The file goes in the project root, or in `src/` if that is used.
- Export **one** function, named `proxy` (or as the default export).
- `config` is optional. `matcher` values must be static literals.
- The runtime is always **Node.js**. Exporting `runtime` **throws**. Keep `middleware.ts` only if Edge is required.
- Codemod: `npx @next/codemod@canary middleware-to-proxy .`. `skipMiddlewareUrlNormalize` is renamed to `skipProxyUrlNormalize`.

```ts
// proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server' // also: NextFetchEvent, NextProxy

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const session = request.cookies.get('admin_session')?.value   // optimistic check only
    if (!session) {
      const url = new URL('/admin/login', request.url)
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)          // Response.redirect also OK
    }
  }
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)    // visible to app via headers()
  const res = NextResponse.next({ request: { headers: requestHeaders } }) // NOT { headers }
  res.headers.set('X-Frame-Options', 'DENY')    // response header to client
  res.cookies.set({ name: 'seen', value: '1', path: '/' })
  return res
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
```

**Matcher**
- Without a matcher, proxy runs on **every** request: `_next/static`, `_next/image`, and `public/`.
- `matcher` accepts a string, an array of strings, or objects `{ source, has?, missing?, locale? }`. `source` must start with `/` and uses path-to-regexp. Use `:path*` for zero or more segments.
- Proxy still runs for `_next/data` even when it is excluded.

**Execution order:** `next.config` headers → `next.config` redirects → **proxy** → `beforeFiles` rewrites → filesystem → `afterFiles` → dynamic routes → fallback.

**Request body**
- When proxy matches a route, the request body is buffered up to `experimental.proxyClientMaxBodySize` (default **10MB**).
- A larger body is **silently truncated**; the request is not rejected.
- **Exclude `/api` (uploads) from the matcher.**

`revalidateTag` and other cache functions are not allowed in proxy. `after()` and `event.waitUntil(promise)` are allowed.

---

## 6. `instrumentation.ts` (`register`)

- The file goes in the project root (or `src/`).
- `register()` is called **once per server instance** and is awaited before the server handles requests, so keep it fast.
- It may be async. An optional `onRequestError` export is typed as `Instrumentation.onRequestError` from `'next'`.
- **[src]** `register()` is **skipped during `next build`** (`NEXT_PHASE === 'phase-production-build'`). This is safe for no-DB builds.
- Next calls `register` in every runtime. Guard with `process.env.NEXT_RUNTIME` (`'nodejs' | 'edge'`) and dynamic-import the Node-only code.

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('./lib/scheduler.node')
    startScheduler()
  }
}
```

```ts
// lib/scheduler.node.ts   [inference: guard against duplicate timers in dev/HMR or multiple module instances]
const g = globalThis as unknown as { __schedulerStarted?: boolean }
export function startScheduler() {
  if (g.__schedulerStarted) return
  g.__schedulerStarted = true
  const t = setInterval(async () => {
    try {
      const changed = await publishDuePosts()        // DB work only; lazy DB client
      if (changed.length) {
        // revalidateTag here would THROW (no request store). Call our own handler instead:
        await fetch(`http://127.0.0.1:${process.env.PORT ?? 3000}/api/internal/revalidate`, {
          method: 'POST',
          headers: { 'x-internal-secret': process.env.INTERNAL_SECRET! },
          body: JSON.stringify({ tags: ['posts', ...changed.map((s) => `post:${s}`)] }),
        })
      }
    } catch (err) { console.error('[scheduler]', err) }
  }, 60_000)
  t.unref?.()
}
```

- With multiple replicas, every instance runs the timer. Use a DB lock or `SELECT ... FOR UPDATE SKIP LOCKED`. **[inference]**
- Graceful shutdown: `next start` / `server.js` drain in-flight requests and `after()` callbacks on SIGTERM.

---

## 7. Route groups and multiple root layouts

```
app/
  (site)/layout.tsx      ← root layout #1: <html><body>
  (site)/page.tsx        ← "/" must live inside a group when app/layout.tsx is absent
  (admin)/admin/layout.tsx ← root layout #2: <html><body>  (any layout with no layout above it is a root layout)
  global-not-found.tsx   ← needs experimental.globalNotFound
  global-error.tsx       ← 'use client', own <html><body>
```

- Each root layout **must** render `<html>` and `<body>`. Don't hand-write `<title>` or `<meta>`; use the Metadata API.
- Each root layout needs its own globals.css, fonts, and providers imports.
- Navigating **across root layouts** causes a **full page load**, not client navigation.
- Two groups must not resolve to the same URL. For example, `(site)/about` and `(admin)/about` → build error.
- **404 with multiple root layouts:** there is no single layout for `app/not-found.tsx` to render in. The documented solution is `app/global-not-found.tsx` + `experimental.globalNotFound: true`.
  - It must return a full `<html><body>` document and import its own CSS and fonts.
  - It can export `metadata`.
  - It handles **unmatched URLs**. `noindex` is auto-injected.
- `notFound()` thrown inside a segment still renders the nearest `not-found.tsx`. For example, `app/(site)/not-found.tsx` renders inside the (site) root layout.
- **Error boundaries (16.3):**
  - `error.tsx` and `global-error.tsx` receive `{ error, retry }`. `retry()` is stable in 16.3 and re-fetches plus re-renders.
  - `reset()` still exists but is the rare case.
  - `global-error` cannot export metadata; use React `<title>`.
- `unauthorized()` and `forbidden()` can't be called in a root layout.
- Under cacheComponents, the static shell includes each root layout. Keep auth reads in the admin layout inside `<Suspense>`.

---

## 8. Metadata at request time (DB-backed, no DB at build)

### 8.1 `generateMetadata`

```tsx
import type { Metadata, ResolvingMetadata } from 'next'
import { connection } from 'next/server'

export async function generateMetadata(
  { params }: PageProps<'/blog/[slug]'>,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  await connection()                       // [inference] keeps DB out of build
  const { slug } = await params
  const post = await getPostBySlug(slug)   // 'use cache' fn
  return { title: post?.title, openGraph: { images: [...((await parent).openGraph?.images ?? [])] } }
}
```

- `generateMetadata` follows component rules. Reading runtime or uncached data defers it to request time, and the metadata is **streamed**: appended to `<body>`.
- HTML-limited bots (facebookexternalhit and others) get it blocking, in `<head>`. Set `htmlLimitedBots` to override.
- If the rest of the page is **fully prerenderable**, request-time metadata → **build error** (`blocking-prerender-metadata-runtime` / `-dynamic`). There are two fixes:
  - make the metadata `'use cache'` (but then it runs at build → needs the DB), or
  - add a dynamic marker to the page, as below.

```tsx
async function Connection() { await connection(); return null }
// in Page JSX:  <Suspense><Connection /></Suspense>
```

- Our DB pages already have a `connection()` inside Suspense (§3.3), which satisfies this rule.
- You can't export both `metadata` and `generateMetadata` from one segment.
- File-based metadata (`opengraph-image.tsx`) overrides `generateMetadata` fields.

### 8.2 `sitemap.ts` / `robots.ts`

- Both are "special Route Handlers", **cached and prerendered by default**. Reading the DB in them would run at build.

```ts
// app/sitemap.ts
import type { MetadataRoute } from 'next'
import { connection } from 'next/server'
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection()   // → rendered per request (shows ƒ). Note new Date() would also be sync-IO at prerender.
  const posts = await listPublishedPosts()            // can be 'use cache' + cacheTag('posts')
  return posts.map((p) => ({ url: `${process.env.SITE_URL}/blog/${p.slug}`, lastModified: p.updatedAt }))
}
```

```ts
// app/robots.ts
import type { MetadataRoute } from 'next'
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/', disallow: '/admin' }, sitemap: 'https://.../sitemap.xml' }
}
```

- `robots.ts` is static unless it reads env at runtime. To read env at runtime, add `await connection()`.
- With `generateSitemaps`, the `id` passed to `sitemap({ id })` is now a **Promise** (16 breaking).

### 8.3 `opengraph-image.tsx` / `twitter-image.tsx`

```tsx
// app/(site)/blog/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og'
import { connection } from 'next/server'
export const alt = 'Security Partners'                       // static only; per-item alt → generateImageMetadata
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  await connection()
  const { slug } = await params
  const post = await getPostBySlug(slug)
  return new ImageResponse(<div style={{ display: 'flex', width: '100%', height: '100%' }}>{post?.title}</div>, { ...size })
}
```

- `params` and `id` are **Promises** (16 breaking). `generateImageMetadata` still receives sync `params`.
- `ImageResponse` limits:
  - flexbox and a subset of CSS only (no grid),
  - 500KB bundle including fonts and images,
  - fonts in ttf, otf, or woff only.
- Read fonts once at **module scope** (`await readFile(join(process.cwd(), 'assets/x.ttf'))`). Standalone tracing must include that file. **[inference]** If tracing misses it, add `outputFileTracingIncludes`.

---

## 9. Route Handlers: `app/api/[...route]/route.ts` (Hono)

- Supported methods: `GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`. If `OPTIONS` is missing, it is auto-implemented.
- Handler signature: `(request: NextRequest, ctx: { params: Promise<...> })`. `RouteContext<'/api/[...route]'>` is a global type after typegen.

```ts
// app/api/[...route]/route.ts
import { app } from '@/server/api'           // Hono app with basePath('/api')
// export const runtime = 'nodejs'           // allowed (default anyway); 'edge' unsupported with cacheComponents
// export const maxDuration = 60             // allowed
// export const dynamic = 'force-dynamic'    // ❌ build error under cacheComponents — do not export
const handler = (req: Request) => app.fetch(req)
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE, handler as OPTIONS }
```

**Prerendering of `GET` under cacheComponents**
- A `GET` handler is prerendered at build **only** if it touches no uncached or runtime data.
- Prerender stops on network or DB access, `req.url`, `request.headers`, `request.cookies`, `request.body`, `cookies()`, `headers()`, `connection()`, or `Math.random()`.
- A catch-all with no `generateStaticParams` is never prerendered. **[inference]**
- Bail-out works by **throwing**. A `try/catch` in the handler will catch it and log noise at build. Set `experimental.hideLogsAfterAbort: true` to hide those logs.
- `'use cache'` cannot be placed on the `GET` export. Put it in a helper function.

**Inside the Hono handler**, Next request-scoped APIs work because it runs within the route handler's request context:
- `cookies()`, `headers()`, `draftMode()`, `revalidateTag`, `revalidatePath`, `after()`
- `unauthorized()` and `forbidden()` (with `authInterrupts`)

**Body size**
- Route Handlers have no Next-imposed body limit.
- If `proxy` matches `/api/*`, the body is buffered and **truncated at 10MB** (`experimental.proxyClientMaxBodySize`). Exclude `/api` from the proxy matcher.
- Server Actions default to a 1MB body (`experimental.serverActions.bodySizeLimit`; it counts multipart overhead).
- Put a reverse proxy in front for payload limits and rate limits.

**Other handler notes**
- Use `request.formData()` and `request.json()` as usual.
- Non-GET methods are never cached.
- `redirect()` from `next/navigation` works in handlers.

---

## 10. `next/image`

```ts
images: {
  remotePatterns: [
    new URL('https://cdn.example.com/media/**'),
    { protocol: 'https', hostname: '**.example.com', pathname: '/media/**', search: '' },
  ],
  localPatterns: [{ pathname: '/api/media/**', search: '' }], // REQUIRED if local src has ?query (16 breaking)
  qualities: [75],            // 16 default [75]; quality prop coerced to nearest allowed
  // minimumCacheTTL, imageSizes defaults changed in 16
  // maximumRedirects: 3 (default, was unlimited)
  // dangerouslyAllowLocalIP: false (default) — optimizer refuses private-IP upstreams → 400
  // maximumResponseBody: 50MB default; maximumDiskCacheSize: 50% free disk default
  // loader: 'custom', loaderFile: './lib/image-loader.ts'  // file: 'use client'; export default ({src,width,quality}) => string
  // unoptimized: true         // global switch
}
```

- **The config is build-time.** `remotePatterns` cannot be changed at runtime. Its `<img>` src must match or the optimizer returns **400**.
- **[inference]** For runtime-configured or arbitrary upload hosts, choose one of these:
  - per-image `unoptimized`,
  - serve uploads through our own `/api/media/*` as **local** images (relative `src`, plus `localPatterns`),
  - a custom loader that builds URLs for an external optimizer.
- The `unoptimized` prop serves `src` as-is. It is automatic for `.svg` `src`. SVG optimization otherwise needs `dangerouslyAllowSVG` plus a CSP.
- `priority` is **deprecated** → use `preload` (or `loading="eager"` / `fetchPriority="high"`).
- `next/legacy/image` and `images.domains` are deprecated.

**Standalone + sharp**
- `sharp@^0.35` is an **optionalDependency of `next`**. pnpm installs it (`@img/sharp-*` prebuilt; the Docker build on alpine gets the musl binaries).
- Standalone output traces it automatically. **[inference]** If tracing misses it: `outputFileTracingIncludes: { '/*': ['node_modules/sharp/**/*'] }` (the documented pattern).
- Standalone does **not** copy `public/` or `.next/static`. Our Dockerfile already copies both.
- On glibc Linux, see sharp's memory-allocator note.
- The optimizer writes a disk cache to `.next/cache/images`. **[inference]** That directory must be writable by the runtime user.

---

## 11. Other 16.x changes that matter here

- **Async request APIs only:**
  - `params` is a `Promise` in layout, page, route, default, and the image routes.
  - `searchParams` is a `Promise` in page.
  - `cookies()`, `headers()`, and `draftMode()` must be awaited.
  - Client page: `const sp = use(searchParams)`.
  - Global type helpers: `PageProps<'/route'>`, `LayoutProps<'/route'>`, `RouteContext<'/route'>`, generated by `next dev`, `next build`, or `next typegen`.
  - Under cacheComponents, pass the `params`/`searchParams` **promise** into a Suspense child and await it there.
- **`after(cb)`** (`next/server`):
  - Runs after the response *or prerender*. In a prerendered page it runs at **build**.
  - Allowed in Server Components, actions, Route Handlers, and proxy.
  - In Server Components, `cookies()` and `headers()` are **not** allowed inside the callback; read them before. They are allowed in handlers and actions.
  - Runs even if the response errored.
- **`unauthorized()` / `forbidden()`** (`next/navigation`):
  - They need **`experimental.authInterrupts: true`** (experimental).
  - Usable in Server Components, Server Functions, and Route Handlers. Not in a root layout.
  - They throw, so don't wrap them in `try/catch` (or use `unstable_rethrow`).
  - Custom UI goes in `unauthorized.tsx` / `forbidden.tsx`.
- **`server-only`:** `import 'server-only'` at the top of DB and DAL modules causes a build error if a Client Component imports them. The package is optional, but install it if lint complains.
- **Parallel routes:** every `@slot` **requires** `default.tsx`, or the build fails.
- **Removed:**
  - `serverRuntimeConfig` and `publicRuntimeConfig`: use `process.env` after `await connection()` for runtime values.
  - `NEXT_PUBLIC_*` values are inlined at build.
  - AMP, `next lint` (use eslint directly; flat config), `experimental.ppr`, `experimental_ppr`, `experimental.dynamicIO`, `experimental.useCache`.
  - The `unstable_` prefix on `cacheLife` and `cacheTag`.
- **Edge runtime is deprecated.** Remove `runtime = 'edge'`.
- **`unstable_cache`** still exists and persists across deploys. Prefer `'use cache'`.
- **Bots:** crawlers get a fully dynamic render, with no shell reuse. Anything the shell needs must also be available at request time.
- **CDN headers:** dynamic or PPR responses get `Cache-Control: private, no-cache, no-store, ...`. Fully static responses get `public`.
- **Multi-instance:** set `deploymentId`, a shared Server Functions encryption key (`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`), and a shared cache handler, or tag invalidation stays per-instance.

---

## 12. Pre-merge checklist

- [ ] `DATABASE_URL= pnpm build` succeeds. No module throws at import; every DB read is behind `<Suspense>` + `await connection()`.
- [ ] No `export const dynamic | revalidate | fetchCache | dynamicParams | runtime='edge'` anywhere.
- [ ] No `generateStaticParams` returning `[]`. Prefer omitting it on DB routes.
- [ ] Every `'use cache'` function has an explicit `cacheLife(...)` and `cacheTag(...)`, takes only serializable args, and reads no cookies or headers.
- [ ] Every `revalidateTag` call has 2 args. No `updateTag` outside Server Actions. No invalidation from timers or render.
- [ ] No `new Date()`, `Date.now()`, or `Math.random()` in prerendered paths (footer year!). Use `'use cache'` or `connection()`.
- [ ] Proxy matcher excludes `api`, `_next/static`, `_next/image`, and metadata files. Auth is re-checked in handlers and actions.
- [ ] Each root layout has `<html><body>`. `global-not-found.tsx` exists with `experimental.globalNotFound`.
- [ ] `useSearchParams`, `usePathname`, and `useParams` consumers are inside `<Suspense>` where params are dynamic.
