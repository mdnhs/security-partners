import "server-only"

type Signal = "SIGTERM" | "SIGINT"

/** The part of `process` used here (tests pass an EventEmitter). */
export type ShutdownProcess = {
  on(event: Signal, listener: (signal: Signal) => void): unknown
  off(event: Signal, listener: (signal: Signal) => void): unknown
  listenerCount(event: Signal): number
  exit(code?: number): unknown
}

const SIGNALS: Signal[] = ["SIGTERM", "SIGINT"]
/** 128 + signal number, as Next's own handler exits (start-server.js). */
const EXIT_CODE: Record<Signal, number> = { SIGINT: 130, SIGTERM: 143 }
/** Our own drain when nobody else exits on the signal. */
export const SHUTDOWN_DRAIN_MS = 10_000
/**
 * Backstop when Next's handler is present: the top of the 10–30 s drain
 * window the Next self-hosting guide recommends. Next normally exits first.
 */
export const NEXT_DRAIN_MAX_MS = 30_000

// On globalThis: register() can run again after a dev HMR reload.
const store = globalThis as unknown as {
  __spShutdown?: WeakSet<ShutdownProcess>
}

/**
 * SIGTERM/SIGINT stop the scheduler: no new ticks, the running job may
 * finish, unstarted claims are released.
 *
 * Who exits is decided at install time. Next 16 (`next start`, standalone
 * server.js) registers its own handler before instrumentation runs; it
 * drains requests and then calls process.exit without waiting for us, so
 * with it present the scheduler drain is best effort: a job still running
 * when Next exits keeps its claim, which falls back to LOCK_TIMEOUT_MS.
 * We only arm an unref'd backstop exit after `nextDrainMaxMs`, so a listener
 * that never exits cannot hang the process.
 *
 * With no listener at install time (NEXT_MANUAL_SIG_HANDLE set, or no Next
 * server) our listener alone would stop Node's default exit, so we wait for
 * the drain (at most `drainMs`) and exit with the signal's code, whatever
 * listeners were added later. Installed once per process; the handlers
 * remove themselves on the first signal. Timers are unref'd: nothing here
 * keeps the process alive.
 */
export function installShutdownHandlers({
  stop,
  proc = process as ShutdownProcess,
  drainMs = SHUTDOWN_DRAIN_MS,
  nextDrainMaxMs = NEXT_DRAIN_MAX_MS,
}: {
  stop: () => Promise<void>
  proc?: ShutdownProcess
  drainMs?: number
  nextDrainMaxMs?: number
}): boolean {
  const installed = (store.__spShutdown ??= new WeakSet())
  if (installed.has(proc)) return false
  installed.add(proc)

  const otherHandler = Object.fromEntries(
    SIGNALS.map((s) => [s, proc.listenerCount(s) > 0])
  ) as Record<Signal, boolean>

  const exitAfter = (ms: number, signal: Signal, first?: Promise<void>) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const limit = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, ms)
      timer.unref?.()
    })
    void Promise.race(first ? [first, limit] : [limit]).then(() => {
      clearTimeout(timer)
      proc.exit(EXIT_CODE[signal])
    })
  }

  const onSignal = (signal: Signal) => {
    for (const s of SIGNALS) proc.off(s, onSignal)
    const drained = Promise.resolve()
      .then(stop)
      .catch((err: unknown) => {
        console.error(
          "[shutdown] stopping the scheduler failed:",
          err instanceof Error ? err.message : String(err)
        )
      })
    if (otherHandler[signal]) exitAfter(nextDrainMaxMs, signal)
    else exitAfter(drainMs, signal, drained)
  }
  for (const s of SIGNALS) proc.on(s, onSignal)
  return true
}
