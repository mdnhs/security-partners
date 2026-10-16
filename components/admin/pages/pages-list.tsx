"use client"

import { useQuery } from "@tanstack/react-query"
import { ChevronRight } from "lucide-react"
import Link from "next/link"

import { statusLabel } from "@/components/admin/editor/editor-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"

/** The eight fixed pages: status and last change (table ≥ 640 px, cards below). */
export function PagesList() {
  const pages = useQuery({
    queryKey: ["pages"],
    queryFn: () => unwrap(api.pages.$get()),
  })
  if (pages.isPending)
    return (
      <div
        className="flex flex-col gap-2"
        aria-busy="true"
        aria-label="Loading pages"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    )
  if (pages.isError)
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-xl border p-6"
      >
        <p className="text-sm">{errorMessage(pages.error)}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => pages.refetch()}
        >
          Try again
        </Button>
      </div>
    )
  const items = pages.data.items
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border bg-card sm:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Pages</caption>
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">
                Page
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Status
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Last change
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((page) => {
              const status = statusLabel({
                published: page.publishedAt ? true : null,
                dirty: page.dirty,
              })
              return (
                <tr key={page.key} className="hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/pages/${page.key}`}
                      className="font-medium hover:underline"
                    >
                      {page.label}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {page.path}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={status.variant}>{status.text}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDateTime(page.updatedAt)}
                    {page.updatedBy ? ` · ${page.updatedBy.name}` : ""}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/pages/${page.key}`}
                      aria-label={`Edit ${page.label}`}
                      className="inline-flex items-center text-muted-foreground hover:text-foreground"
                    >
                      <ChevronRight aria-hidden className="size-4" />
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <ul aria-label="Pages" className="flex flex-col gap-2 sm:hidden">
        {items.map((page) => {
          const status = statusLabel({
            published: page.publishedAt ? true : null,
            dirty: page.dirty,
          })
          return (
            <li key={page.key}>
              <Link
                href={`/admin/pages/${page.key}`}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-medium">{page.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {page.path} · {formatDateTime(page.updatedAt)}
                  </span>
                </div>
                <Badge variant={status.variant}>{status.text}</Badge>
                <ChevronRight
                  aria-hidden
                  className="size-4 text-muted-foreground"
                />
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
