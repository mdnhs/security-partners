// Next calls register() once per server instance, before it serves requests,
// and never during `next build` (notes §6). The in-process scheduler
// (spec §12) runs on the Node.js runtime only; SIGTERM/SIGINT stop it
// (server/lib/shutdown.ts: Next's own handler still drains and exits).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler, stopScheduler } =
      await import("./server/lib/scheduler")
    const { installShutdownHandlers } = await import("./server/lib/shutdown")
    startScheduler()
    installShutdownHandlers({ stop: stopScheduler })
  }
}
