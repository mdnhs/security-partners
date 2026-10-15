import "server-only"

const DISPOSABLE_NAME = /_(dev|test|e2e)$/
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"])

/** Host and database name only (never credentials), for messages. */
export function describeDatabase(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname}`
  } catch {
    return "an unparseable DATABASE_URL"
  }
}

/** Spec §14: provably disposable = name ends _dev/_test/_e2e, or a local host. */
export function isDisposableDatabase(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, ""))
  return DISPOSABLE_NAME.test(name) || LOCAL_HOSTS.has(parsed.hostname)
}

/** Throws unless the target database is disposable or the caller passed --allow-production. */
export function assertDisposable(url: string, allowProduction: boolean): void {
  if (allowProduction || isDisposableDatabase(url)) return
  throw new Error(
    `Refusing to write seed or demo data to ${describeDatabase(url)}: the database name does not end in _dev, _test or _e2e and the host is not local. Re-run with --allow-production if this is intended.`
  )
}
