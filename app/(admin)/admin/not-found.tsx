import Link from "next/link"

import { LINK_FORM } from "@/components/admin/page-header"

/** 404 for /admin/* (admin root layout, not the public site's). */
export default function AdminNotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <section className="rounded-card flex max-w-md flex-col items-center gap-4 bg-sidebar px-8 py-12 text-center">
        <h1 className="text-card-title">That page doesn&apos;t exist</h1>
        <p className="text-sm text-muted-foreground">
          Check the address, or go back to the dashboard and use the menu.
        </p>
        <Link href="/admin" className={LINK_FORM}>
          Back to the dashboard
        </Link>
      </section>
    </main>
  )
}
