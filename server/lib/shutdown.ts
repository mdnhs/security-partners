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
/** Within the 10–30 s drain the Next self-hosting guide recommends. */
export const SHUTDOWN_DRAIN_MS = 10_000

// On globalThis: register() can run again after a dev HMR reload.
const store = globalThis as unknown as {
  __spShutdown?: WeakSet<ShutdownProcess>
}

/**
 * SIGTERM/SIGINT stop the scheduler (no new ticks; the running job finishes
 * and unstarted claims are released). Next 16 (`next start` and the
 * standalone server.js) has its own handler that drains requests and then
 * exits, so this one never calls process.exit while another listener is
 * there. Without one (NEXT_MANUAL_SIG_HANDLE set, or no Next server), our
 * listener alone would stop Node's default exit on the signal, so it waits
 * for the drain (at most `drainMs`, on an unref'd timer) and exits with the
 * signal's code itself. Installed once per process; the handlers remove
 * themselves on the first signal.
 */
export function installShutdownHandlers({
  stop,
  proc = process as ShutdownProcess,
  drainMs = SHUTDOWN_DRAIN_MS,
}: {
  stop: () => Promise<void>
  proc?: ShutdownProcess
  drainMs?: number
}): boolean {
  const installed = (store.__spShutdown ??= new WeakSet())
  if (installed.has(proc)) return false
  installed.add(proc)

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
    // Someone else (Next) handles this signal and exits when it is done.
    if (proc.listenerCount(signal) > 0) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const limit = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, drainMs)
      timer.unref?.()
    })
    void Promise.race([drained, limit]).then(() => {
      clearTimeout(timer)
      proc.exit(EXIT_CODE[signal])
    })
  }
  for (const s of SIGNALS) proc.on(s, onSignal)
  return true
}
