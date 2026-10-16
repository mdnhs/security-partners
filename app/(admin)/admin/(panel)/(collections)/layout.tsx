import { CollectionTabs } from "@/components/admin/collections/collection-tabs"

/** Team, Clients, Group companies and Categories share one tab column. */
export default function CollectionsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <CollectionTabs>{children}</CollectionTabs>
}
