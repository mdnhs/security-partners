// Next calls register() once per server instance, before it serves requests,
// and never during `next build` (notes §6). The in-process scheduler
// (spec §12) runs on the Node.js runtime only.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./server/lib/scheduler")
    startScheduler()
  }
}
