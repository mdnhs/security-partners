import { redirect } from "next/navigation"

/** Everyone who can open Marketing can read Tracking (its first tab). */
export default function MarketingPage() {
  redirect("/admin/marketing/tracking")
}
