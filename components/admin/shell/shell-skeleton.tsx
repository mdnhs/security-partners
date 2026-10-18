/**
 * The admin frame's outline while the session and settings load (final
 * review M13: a hard load showed a blank page): the same floating panels
 * as AdminShell (sidebar from lg, topbar, content) in muted placeholders.
 */
export function AdminShellSkeleton() {
  return (
    <div className="flex h-svh gap-4 p-3 sm:p-4">
      <div
        aria-hidden
        className="rounded-card hidden w-80 shrink-0 animate-pulse bg-sidebar motion-reduce:animate-none lg:block"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div
          aria-hidden
          className="rounded-card h-[72px] shrink-0 animate-pulse bg-sidebar motion-reduce:animate-none"
        />
        <div
          role="status"
          className="rounded-card flex-1 animate-pulse bg-sidebar motion-reduce:animate-none"
        >
          <span className="sr-only">Loading the admin…</span>
        </div>
      </div>
    </div>
  )
}
