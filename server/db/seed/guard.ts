import "server-only"

import { parse } from "pg-connection-string"

const DISPOSABLE_NAME = /_(dev|test|e2e)$/
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"])
/** A URL pg understands (postgres://, postgresql://, socket://) or a bare socket path. */
const CONNECTION_STRING = /^(?:(?:postgres(?:ql)?|socket):\/\/|\/)/i

type Target = {
  host: string
  port: string
  database: string
  hostaddr: boolean
}

/**
 * The database pg would actually connect to. Uses pg's own parser, so
 * `?host=` / `?hostaddr=` overrides and socket paths count, not just the URL
 * authority. null for anything malformed (never throws).
 */
function effectiveTarget(url: string): Target | null {
  if (!CONNECTION_STRING.test(url)) return null
  try {
    // Malformed percent-encoding: pg would re-encode it, we refuse instead.
    decodeURIComponent(url)
    const config = parse(url)
    return {
      host: config.host ?? "",
      port: config.port ?? "",
      database: config.database ?? "",
      hostaddr: "hostaddr" in config,
    }
  } catch {
    return null
  }
}

/** Host and database name only (never credentials), for messages. */
export function describeDatabase(url: string): string {
  const target = effectiveTarget(url)
  if (!target) return "an unparseable DATABASE_URL"
  return `${target.host || "(default host)"}${target.port ? `:${target.port}` : ""}/${target.database}`
}

/**
 * Spec §14: provably disposable = name ends _dev/_test/_e2e, or a local TCP
 * host (localhost, 127.0.0.1, ::1). A socket path, an empty host or any
 * `hostaddr` override is not local; malformed input is never disposable.
 */
export function isDisposableDatabase(url: string): boolean {
  const target = effectiveTarget(url)
  if (!target || target.hostaddr) return false
  return DISPOSABLE_NAME.test(target.database) || LOCAL_HOSTS.has(target.host)
}

/** Throws unless the target database is disposable or the caller passed --allow-production. */
export function assertDisposable(url: string, allowProduction: boolean): void {
  if (allowProduction || isDisposableDatabase(url)) return
  throw new Error(
    `Refusing to write seed or demo data to ${describeDatabase(url)}: the database name does not end in _dev, _test or _e2e and the host is not local. Re-run with --allow-production if this is intended.`
  )
}
