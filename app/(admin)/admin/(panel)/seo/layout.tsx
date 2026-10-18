import { NavChildTabs } from "@/components/admin/shell/nav-child-tabs"

/** SEO › Overview · Defaults · Redirects as route tabs. */
export default function SeoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <NavChildTabs basePath="/admin/seo">{children}</NavChildTabs>
}
