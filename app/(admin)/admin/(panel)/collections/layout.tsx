import { CollectionTabs } from "@/components/admin/collections/collection-tabs"

/** Team, Clients and Group companies share one tab column. */
export default function CollectionsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <CollectionTabs>{children}</CollectionTabs>
}
