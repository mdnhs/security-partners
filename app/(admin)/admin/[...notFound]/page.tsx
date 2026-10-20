import { notFound } from "next/navigation"

/**
 * Unmatched /admin/* URLs 404 inside the admin root layout
 * (app/(admin)/admin/not-found.tsx) instead of falling through to the public
 * site's catch-all.
 */
export default function AdminCatchAllNotFound() {
  notFound()
}
