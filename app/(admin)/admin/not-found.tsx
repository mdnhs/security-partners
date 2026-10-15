import Link from "next/link"

/** 404 for /admin/* (admin root layout, not the public site's). */
export default function AdminNotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <div className="flex max-w-sm flex-col gap-3 text-center">
        <h1 className="text-xl font-bold">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          This admin page does not exist. Check the address or go back to the
          dashboard.
        </p>
        <Link href="/admin" className="text-sm underline underline-offset-4">
          Back to the dashboard
        </Link>
      </div>
    </main>
  )
}
