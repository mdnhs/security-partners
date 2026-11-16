"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

import { loadAllPages } from "@/components/admin/collections/reorder-panel"
import { CardSkeleton } from "@/components/admin/kit/skeletons"
import {
  type SortableItem,
  SortableList,
} from "@/components/admin/sortable-list"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { usePermission } from "@/hooks/use-permission"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import type { ServiceListItem } from "@/lib/schemas/api/services"
import { cn } from "@/lib/utils"

const queryKey = ["services", "inline"] as const

type Item = SortableItem & { service: ServiceListItem }

/**
 * The service cards, inline under the Services section: drag to reorder,
 * edit, delete, add.
 */
export function ServicesInlineList() {
  const queryClient = useQueryClient()
  const canCreate = usePermission({ service: ["create"] })
  const canUpdate = usePermission({ service: ["update"] })
  const canDelete = usePermission({ service: ["delete"] })
  const [removing, setRemoving] = useState<ServiceListItem | null>(null)

  const list = useQuery({
    queryKey,
    queryFn: async (): Promise<Item[]> =>
      (
        await loadAllPages((page, pageSize) =>
          unwrap(
            api.services.$get({
              query: {
                page: String(page),
                pageSize: String(pageSize),
                sort: "sortOrder:asc",
              },
            })
          )
        )
      ).map((service) => ({ id: service.id, label: service.title, service })),
  })
  const items = list.data ?? []

  const reorder = useMutation({
    mutationFn: (next: Item[]) =>
      unwrap(
        api.reorder[":collection"].$put({
          param: { collection: "services" },
          json: { ids: next.map((i) => i.id) },
        })
      ),
    onMutate: (next) => queryClient.setQueryData(queryKey, next),
    onSuccess: () => {
      toast.success("Order saved", {
        description: "The site shows the new order now.",
      })
    },
    onError: (error) => {
      toast.error("Order not saved", { description: errorMessage(error) })
      void list.refetch()
    },
  })

  const remove = useMutation({
    mutationFn: (service: ServiceListItem) =>
      unwrap(
        api.services[":id"].$delete({
          param: { id: service.id },
          query: { version: String(service.version) },
        })
      ),
    onSuccess: async (_, service) => {
      toast.success(`${service.title} deleted`)
      setRemoving(null)
      await queryClient.invalidateQueries({ queryKey: ["services"] })
    },
    onError: (error) => {
      setRemoving(null)
      toast.error("Not deleted", { description: errorMessage(error) })
    },
  })

  return (
    <section
      aria-labelledby="services-inline-title"
      className="flex flex-col gap-3 border-t pt-5"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 id="services-inline-title" className="text-[15px] font-semibold">
            Services
          </h3>
          <p className="text-sm text-muted-foreground">
            One card each. Drag to reorder.
          </p>
        </div>
        {canCreate ? (
          <Link
            href="/admin/services/new"
            className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
          >
            <Plus aria-hidden />
            Add service
          </Link>
        ) : null}
      </header>
      {list.isPending ? (
        <div role="status">
          <span className="sr-only">Loading services…</span>
          <CardSkeleton className="h-40" />
        </div>
      ) : list.isError ? (
        <p role="alert" className="text-sm text-destructive">
          The services didn’t load. {errorMessage(list.error)}
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No services yet.</p>
      ) : (
        <SortableList<Item>
          label="Services order"
          items={items}
          disabled={!canUpdate || reorder.isPending}
          onReorder={(next) => reorder.mutate(next)}
          actions={({ service }) => (
            <>
              <Link
                href={`/admin/services/${service.id}`}
                aria-label={`Edit ${service.title}`}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" })
                )}
              >
                <Pencil aria-hidden />
              </Link>
              {canDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${service.title}`}
                  className="text-destructive hover:text-destructive"
                  onClick={() => setRemoving(service)}
                >
                  <Trash2 aria-hidden />
                </Button>
              ) : null}
            </>
          )}
        />
      )}
      <AlertDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {removing?.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              The card and the page /services/{removing?.slug} disappear from
              the site.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => removing && remove.mutate(removing)}
            >
              Delete service
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
