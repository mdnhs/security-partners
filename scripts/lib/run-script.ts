import { closeDb } from "@/server/db/client"
import { getEnv } from "@/server/env"

/**
 * Shared wrapper for operator scripts: validates the env first (readable
 * list of missing vars), prints `[name] message` on failure with exit code 1,
 * and always closes the database pool.
 */
export async function runScript(
  name: string,
  main: () => Promise<void>
): Promise<void> {
  try {
    getEnv()
    await main()
  } catch (err) {
    console.error(
      `[${name}] ${err instanceof Error ? err.message : String(err)}`
    )
    process.exitCode = 1
  } finally {
    await closeDb()
  }
}
