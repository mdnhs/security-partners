"use client"

import type { ReactNode } from "react"
import type { z } from "zod"

import {
  columnsFor,
  type DataTableColumns,
} from "@/components/admin/data-table/data-table"
import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"
import { emptyValue } from "@/components/admin/schema-form/empty-value"
import { Badge } from "@/components/ui/badge"
import {
  type CategoryItem,
  type ClientItem,
  type CollectionName,
  collectionSchemas,
  type GroupCompanyItem,
  type TeamItem,
} from "@/lib/schemas/api/collections"

import { RelativeTime } from "@/components/admin/kit/relative-time"

import { MediaThumb } from "./media-thumb"

export type AnyItem = (
  TeamItem | ClientItem | GroupCompanyItem | CategoryItem
) &
  Record<string, unknown>

export type CollectionConfig = {
  title: string
  singular: string
  description: string
  schema: z.ZodObject
  meta: EditorMeta
  columns: DataTableColumns<AnyItem>
  /** Phone card content. */
  card: (item: AnyItem) => ReactNode
  /** Label in the reorder list. */
  itemLabel: (item: AnyItem) => string
  /** Blank record for "Add". */
  blank: () => unknown
  /** Record → form value (drops id/sortOrder/updatedAt/articleCount). */
  toForm: (item: AnyItem) => unknown
  /** Empty-list title. */
  empty: string
  /** Where records appear once added (shown under the empty title). */
  emptyDescription: string
}

const team = columnsFor<TeamItem & Record<string, unknown>>()
const clients = columnsFor<ClientItem & Record<string, unknown>>()
const groups = columnsFor<GroupCompanyItem & Record<string, unknown>>()
const categories = columnsFor<CategoryItem & Record<string, unknown>>()

const updated = (value: string) => (
  <span className="text-muted-foreground">
    <RelativeTime iso={value} />
  </span>
)
const pick = (item: AnyItem, keys: string[]) =>
  Object.fromEntries(keys.map((k) => [k, item[k]]))

// Column definitions live at module scope (TanStack Table v9 needs stable references).
export const COLLECTION_CONFIGS: Record<CollectionName, CollectionConfig> = {
  team: {
    title: "Team",
    singular: "Team member",
    description:
      "People shown on the Team page and the home page, in this order.",
    schema: collectionSchemas.team,
    meta: {
      fields: {
        bio: { label: "Short bio" },
        photo: {
          label: "Photo",
          help: "Optional. Without a photo the placeholder from the Team page is shown.",
        },
      },
    },
    columns: team.columns([
      team.accessor("name", {
        header: "Name",
        cell: (info) => (
          <span className="flex items-center gap-3">
            <MediaThumb mediaId={info.row.original.photo?.mediaId} size={32} />
            <span className="font-medium">{info.getValue()}</span>
          </span>
        ),
      }),
      team.accessor("role", { header: "Role", enableSorting: false }),
      team.accessor("email", { header: "Email", enableSorting: false }),
      team.accessor("updatedAt", {
        header: "Updated",
        cell: (info) => updated(info.getValue()),
      }),
    ]) as unknown as DataTableColumns<AnyItem>,
    card: (item) => {
      const t = item as TeamItem
      return (
        <span className="flex items-center gap-3">
          <MediaThumb mediaId={t.photo?.mediaId} />
          <span className="flex min-w-0 flex-col">
            <span className="font-medium">{t.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {t.role}
            </span>
          </span>
        </span>
      )
    },
    itemLabel: (item) => String(item.name),
    blank: () => emptyValue(collectionSchemas.team),
    toForm: (item) => pick(item, ["name", "role", "bio", "email", "photo"]),
    empty: "No team members yet",
    emptyDescription:
      "People added here appear on the Team page and the home page.",
  },
  clients: {
    title: "Clients",
    singular: "Client",
    description: "Logos in the clients strip, in this order.",
    schema: collectionSchemas.clients,
    meta: {
      fields: {
        logo: { label: "Logo" },
        url: { label: "Website", help: "Optional, https://…" },
      },
    },
    columns: clients.columns([
      clients.accessor("name", {
        header: "Client",
        cell: (info) => (
          <span className="flex items-center gap-3">
            <MediaThumb mediaId={info.row.original.logo.mediaId} size={32} />
            <span className="font-medium">{info.getValue()}</span>
          </span>
        ),
      }),
      clients.accessor("url", {
        header: "Website",
        enableSorting: false,
        cell: (info) => info.getValue() ?? "—",
      }),
      clients.accessor("updatedAt", {
        header: "Updated",
        cell: (info) => updated(info.getValue()),
      }),
    ]) as unknown as DataTableColumns<AnyItem>,
    card: (item) => {
      const c = item as ClientItem
      return (
        <span className="flex items-center gap-3">
          <MediaThumb mediaId={c.logo.mediaId} />
          <span className="font-medium">{c.name}</span>
        </span>
      )
    },
    itemLabel: (item) => String(item.name),
    blank: () => emptyValue(collectionSchemas.clients),
    toForm: (item) => pick(item, ["name", "logo", "url"]),
    empty: "No clients yet",
    emptyDescription: "Logos added here appear in the clients strip.",
  },
  "group-companies": {
    title: "Group companies",
    singular: "Group company",
    description: "“Other services in the group” in the footer, in this order.",
    schema: collectionSchemas["group-companies"],
    meta: {
      fields: {
        site: {
          label: "Website domain",
          help: "Domain only, e.g. www.example.ie.",
        },
        logo: { label: "Logo" },
      },
    },
    columns: groups.columns([
      groups.accessor("name", {
        header: "Company",
        cell: (info) => (
          <span className="flex items-center gap-3">
            <MediaThumb mediaId={info.row.original.logo.mediaId} size={32} />
            <span className="font-medium">{info.getValue()}</span>
          </span>
        ),
      }),
      groups.accessor("phone", { header: "Phone", enableSorting: false }),
      groups.accessor("site", { header: "Website", enableSorting: false }),
      groups.accessor("updatedAt", {
        header: "Updated",
        cell: (info) => updated(info.getValue()),
      }),
    ]) as unknown as DataTableColumns<AnyItem>,
    card: (item) => {
      const g = item as GroupCompanyItem
      return (
        <span className="flex items-center gap-3">
          <MediaThumb mediaId={g.logo.mediaId} />
          <span className="flex min-w-0 flex-col">
            <span className="font-medium">{g.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {g.site}
            </span>
          </span>
        </span>
      )
    },
    itemLabel: (item) => String(item.name),
    blank: () => emptyValue(collectionSchemas["group-companies"]),
    toForm: (item) => pick(item, ["name", "phone", "site", "logo"]),
    empty: "No group companies yet",
    emptyDescription:
      "Companies added here appear in the footer under “Other services in the group”.",
  },
  categories: {
    title: "Categories",
    singular: "Category",
    description:
      "Article categories. Those shown in the filter appear on the blog page, in this order.",
    schema: collectionSchemas.categories,
    meta: {
      fields: {
        slug: {
          label: "Address",
          help: "Used in /blog?category=…: lowercase letters, numbers and hyphens.",
        },
        showInFilter: { label: "Show in the blog filter" },
      },
    },
    columns: categories.columns([
      categories.accessor("name", {
        header: "Name",
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      categories.accessor("slug", { header: "Address", enableSorting: false }),
      categories.accessor("showInFilter", {
        header: "In filter",
        enableSorting: false,
        cell: (info) =>
          info.getValue() ? (
            <Badge variant="secondary">Shown</Badge>
          ) : (
            <Badge variant="outline">Hidden</Badge>
          ),
      }),
      categories.accessor("articleCount", {
        header: "Articles",
        enableSorting: false,
      }),
    ]) as unknown as DataTableColumns<AnyItem>,
    card: (item) => {
      const c = item as CategoryItem
      return (
        <span className="flex flex-col">
          <span className="font-medium">{c.name}</span>
          <span className="text-xs text-muted-foreground">
            {c.articleCount} article{c.articleCount === 1 ? "" : "s"} ·{" "}
            {c.showInFilter ? "in filter" : "not in filter"}
          </span>
        </span>
      )
    },
    itemLabel: (item) => String(item.name),
    blank: () => emptyValue(collectionSchemas.categories),
    toForm: (item) => pick(item, ["slug", "name", "showInFilter"]),
    empty: "No categories yet",
    emptyDescription: "Categories group articles on the blog.",
  },
}
