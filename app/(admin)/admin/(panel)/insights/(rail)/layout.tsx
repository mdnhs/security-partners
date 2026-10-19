import { NavChildTabs } from "@/components/admin/shell/nav-child-tabs"

/**
 * Insights › Articles · Categories as route tabs. The article editor and
 * New article sit outside this group, so they keep the full panel width.
 */
export default function InsightsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <NavChildTabs basePath="/admin/insights">{children}</NavChildTabs>
}
