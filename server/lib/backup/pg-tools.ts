import "server-only"

import { spawn } from "node:child_process"

import { parse } from "pg-connection-string"

export type PgTool = "pg_dump" | "pg_restore"

const LIBPQ_VARS = [
  "PGHOST",
  "PGPORT",
  "PGUSER",
  "PGPASSWORD",
  "PGDATABASE",
  "PGSSLMODE",
] as const

/**
 * Connection parts as libpq sees them. `sslmode` is read from the URL
 * verbatim and kept away from pg-connection-string, whose node-pg SSL mapping
 * (and its deprecation warning) does not apply to the libpq client tools.
 */
function libpqParts(url: string): Record<string, unknown> {
  const target = new URL(url)
  const sslmode = target.searchParams.get("sslmode")
  target.searchParams.delete("sslmode")
  return { ...parse(target.toString()), sslmode }
}

/**
 * libpq environment for one connection string. pg_dump/pg_restore get the
 * password through PGPASSWORD, never on their command line (visible in
 * `ps` and in error output). Inherited PG* variables are dropped first so a
 * stray PGPASSWORD can never reach another server.
 */
export function pgEnv(
  url: string,
  base: Partial<NodeJS.ProcessEnv> = process.env
): NodeJS.ProcessEnv {
  const config = libpqParts(url)
  const env = {
    ...base,
    PGCONNECT_TIMEOUT: "10",
    PGAPPNAME: "sp-ops",
  } as NodeJS.ProcessEnv
  for (const key of LIBPQ_VARS) delete env[key]
  const set = (key: (typeof LIBPQ_VARS)[number], value: unknown) => {
    if (typeof value === "string" && value !== "") env[key] = value
  }
  set("PGHOST", config.host)
  set("PGPORT", config.port)
  set("PGUSER", config.user)
  set("PGPASSWORD", config.password)
  set("PGDATABASE", config.database)
  set("PGSSLMODE", config.sslmode)
  return env
}

/** The same server and credentials, another database (scratch restores). */
export function withDatabase(url: string, database: string): string {
  const target = new URL(url)
  target.pathname = `/${encodeURIComponent(database)}`
  return target.toString()
}

/**
 * Runs pg_dump/pg_restore against `url` (connection via pgEnv). Resolves on
 * exit code 0; otherwise rejects with the tail of stderr, the password
 * replaced by ***.
 */
export function runPgTool(
  tool: PgTool,
  args: readonly string[],
  url: string
): Promise<void> {
  const password = libpqParts(url).password as string | undefined
  return new Promise((resolvePromise, reject) => {
    const child = spawn(tool, args, {
      env: pgEnv(url),
      stdio: ["ignore", "ignore", "pipe"],
    })
    let stderr = ""
    child.stderr.setEncoding("utf8")
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-4000)
    })
    child.on("error", (err: NodeJS.ErrnoException) => {
      reject(
        err.code === "ENOENT"
          ? new Error(
              `${tool} was not found on PATH: install the PostgreSQL 17 client tools (the production image includes them)`
            )
          : err
      )
    })
    child.on("close", (code) => {
      if (code === 0) return resolvePromise()
      const redacted = password ? stderr.replaceAll(password, "***") : stderr
      const detail = redacted.trim().slice(-500)
      reject(
        new Error(
          `${tool} exited with code ${code}${detail ? `: ${detail}` : ""}`
        )
      )
    })
  })
}
