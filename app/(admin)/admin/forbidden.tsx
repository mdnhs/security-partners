import Link from "next/link"

import { LINK_FORM } from "@/components/admin/page-header"
import { AdminThemed } from "@/components/admin/theme/admin-themed"

/** Rendered (403) when requirePermission() calls forbidden(). */
export default function Forbidden() {
  return (
    <AdminThemed>
      <main className="flex min-h-svh items-center justify-center bg-background p-4">
        <section className="rounded-card flex max-w-md flex-col items-center gap-4 bg-sidebar px-8 py-12 text-center">
          <h1 className="text-card-title">
            You do not have access to this page
          </h1>
          <p className="text-sm text-muted-foreground">
            Your role does not include this area. Ask an owner or administrator
            if you need it.
          </p>
          <Link href="/admin" className={LINK_FORM}>
            Back to the dashboard
          </Link>
        </section>
      </main>
    </AdminThemed>
  )
}
