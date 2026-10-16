"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowUpDown, Pencil, Plus } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import {
  DataTable,
  type DataTableColumns,
} from "@/components/admin/data-table/data-table"
import { PageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { usePermission } from "@/hooks/use-permission"
import { api, unwrap } from "@/lib/api-client"
import type { CollectionName } from "@/lib/schemas/api/collections"
import type { Paginated } from "@/lib/schemas/api/list"

import { type AnyItem, COLLECTION_CONFIGS } from "./configs"
import { RecordSheet } from "./record-sheet"
import { loadAllPages, ReorderPanel } from "./reorder-panel"

type ApiParams = { page: string; pageSize: string; sort?: string; q?: string }

/** The four collection routers share one shape; typed loosely so one screen serves all. */
type CollectionClient = {
  $get: (args: { query: ApiParams }) => Promise<Response>
  $post: (args: { json: unknown }) => Promise<Response>
  ":id": {
    $get: (args: { param: { id: string } }) => Promise<Response>
    $put: (args: { param: { id: string }; json: unknown }) => Promise<Response>
    $delete: (args: { param: { id: string } }) => Promise<Response>
  }
}

function client(name: CollectionName) {
  const c = api[name] as unknown as CollectionClient
  return {
    list: (query: ApiParams) => unwrap<Paginated<AnyItem>>(c.$get({ query })),
    create: (json: unknown) => unwrap<AnyItem>(c.$post({ json })),
    update: (id: string, json: unknown) =>
      unwrap<AnyItem>(c[":id"].$put({ param: { id }, json })),
    remove: (id: string) =>
      unwrap<{ ok: true }>(c[":id"].$delete({ param: { id } })),
    get: (id: string) => unwrap<AnyItem>(c[":id"].$get({ param: { id } })),
  }
}

/**
 * List + edit screen for one small collection (master 4.6): server-paged
 * table (cards on phones), add/edit in a sheet, delete, reorder.
 * `?edit=<id>` opens a record (⌘K results link here).
 */
export function CollectionScreen({ name }: { name: CollectionName }) {
  const config = COLLECTION_CONFIGS[name]
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const canCreate = usePermission({ collection: ["create"] })
  const canUpdate = usePermission({ collection: ["update"] })
  const canDelete = usePermission({ collection: ["delete"] })
  const [reordering, setReordering] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<AnyItem | null>(null)
  const editId = searchParams.get("edit")
  const api = client(name)
  const queryKey = ["collections", name] as const

  const refresh = () => queryClient.invalidateQueries({ queryKey })
  const closeEdit = () => {
    setEditing(null)
    if (editId) router.replace(pathname)
  }

  // Stable per collection + permission (TanStack Table v9 wants stable columns).
  const columns = useMemo<DataTableColumns<AnyItem>>(
    () =>
      canUpdate
        ? [
            ...config.columns,
            {
              id: "actions",
              header: () => <span className="sr-only">Actions</span>,
              enableSorting: false,
              cell: ({ row }) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${config.itemLabel(row.original)}`}
                  onClick={() => setEditing(row.original)}
                >
                  <Pencil aria-hidden />
                </Button>
              ),
            },
          ]
        : config.columns,
    [config, canUpdate]
  )

  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          <>
            {canUpdate ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setReordering((v) => !v)}
                aria-pressed={reordering}
              >
                <ArrowUpDown aria-hidden />
                {reordering ? "Back to list" : "Change order"}
              </Button>
            ) : null}
            {canCreate ? (
              <Button type="button" onClick={() => setCreating(true)}>
                <Plus aria-hidden />
                Add {config.singular.toLowerCase()}
              </Button>
            ) : null}
          </>
        }
      />
      {reordering ? (
        <ReorderPanel
          collection={name}
          label={`${config.title} order`}
          queryKey={queryKey}
          load={async () => {
            const items = await loadAllPages((page, pageSize) =>
              api.list({
                page: String(page),
                pageSize: String(pageSize),
                sort: "sortOrder:asc",
              })
            )
            return items.map((item) => ({
              id: item.id,
              label: config.itemLabel(item),
            }))
          }}
          onDone={() => setReordering(false)}
        />
      ) : (
        <DataTable<AnyItem>
          label={config.title}
          queryKey={queryKey}
          fetchPage={async (params) => {
            return api.list({
              page: String(params.page),
              pageSize: String(params.pageSize),
              sort: params.sort,
              q: params.q,
            })
          }}
          columns={columns}
          renderCard={(item) =>
            canUpdate ? (
              <button
                type="button"
                onClick={() => setEditing(item)}
                className="w-full rounded-xl border bg-card p-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label={`Edit ${config.itemLabel(item)}`}
              >
                {config.card(item)}
              </button>
            ) : (
              <div className="rounded-xl border bg-card p-3">
                {config.card(item)}
              </div>
            )
          }
          empty={config.empty}
        />
      )}
      {creating ? (
        <RecordSheet
          open
          onOpenChange={(open) => !open && setCreating(false)}
          title={config.singular}
          description={`New ${config.singular.toLowerCase()}. It appears on the site as soon as you save.`}
          schema={config.schema}
          meta={config.meta}
          initial={config.blank()}
          onSave={async (value) => {
            await api.create(value)
            await refresh()
          }}
        />
      ) : null}
      <EditSheet
        key={editing?.id ?? editId ?? "none"}
        name={name}
        item={editing}
        editId={editing ? null : editId}
        canEdit={canUpdate}
        canDelete={canDelete}
        onClose={closeEdit}
        onSaved={refresh}
      />
    </>
  )
}

function EditSheet({
  name,
  item,
  editId,
  canEdit,
  canDelete,
  onClose,
  onSaved,
}: {
  name: CollectionName
  item: AnyItem | null
  /** `?edit=<id>` (⌘K): the record is loaded by id. */
  editId: string | null
  canEdit: boolean
  canDelete: boolean
  onClose: () => void
  onSaved: () => Promise<unknown>
}) {
  const config = COLLECTION_CONFIGS[name]
  const api = client(name)
  const loaded = useQuery({
    // Outside ["collections", name] so a list refresh after delete doesn't refetch it.
    queryKey: ["collection-item", name, editId],
    queryFn: () => api.get(editId!),
    enabled: !!editId && canEdit,
    retry: false,
  })
  const failed = loaded.isError
  useEffect(() => {
    if (!failed) return
    toast.error(`${config.singular} not found`, {
      description: "It may have been deleted.",
    })
    onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per failure
  }, [failed])
  const record = item ?? loaded.data ?? null
  if (!record || !canEdit) return null
  return (
    <RecordSheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={config.singular}
      description="Changes appear on the site as soon as you save."
      schema={config.schema}
      meta={config.meta}
      initial={config.toForm(record)}
      onSave={async (value) => {
        await api.update(record.id, value)
        await onSaved()
      }}
      onDelete={
        canDelete
          ? async () => {
              await api.remove(record.id)
              await onSaved()
            }
          : undefined
      }
      deleteLabel={`Delete ${config.singular.toLowerCase()}`}
    />
  )
}
