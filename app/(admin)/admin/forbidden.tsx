import Link from "next/link"

/** Rendered (403) when requirePermission() calls forbidden(). */
export default function Forbidden() {
  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <div className="flex max-w-sm flex-col gap-3 text-center">
        <h1 className="text-xl font-bold">
          You do not have access to this page
        </h1>
        <p className="text-sm text-muted-foreground">
          Your role does not include this area. Ask an owner or administrator if
          you need it.
        </p>
        <Link href="/admin" className="text-sm underline underline-offset-4">
          Back to the dashboard
        </Link>
      </div>
    </main>
  )
}
