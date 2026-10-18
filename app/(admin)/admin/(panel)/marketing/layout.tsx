import { NavChildTabs } from "@/components/admin/shell/nav-child-tabs"

/** Marketing › Tracking · Consent banner · Custom code as route tabs. */
export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <NavChildTabs basePath="/admin/marketing">{children}</NavChildTabs>
}
