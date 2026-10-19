"use client"

import { useQuery } from "@tanstack/react-query"
import { FilePlus2, FileText } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import {
  BUILDER_PAGES_KEY,
  NewPageDialog,
} from "@/components/admin/builder/new-page-dialog"

import { ContentStatusPills } from "@/components/admin/kit/content-status"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { RelativeTime } from "@/components/admin/kit/relative-time"
import { CardSkeleton } from "@/components/admin/kit/skeletons"
import { FORM_ACTION, PRIMARY_ACTION } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { usePermission } from "@/hooks/use-permission"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import type { BuilderPageListItem } from "@/lib/schemas/api/builder-pages"
import type { PageListItem } from "@/lib/schemas/api/content"

const stateOf = (page: PageListItem) => ({
  published: page.publishedAt ? true : null,
  dirty: page.dirty,
})

/** Relative to the last fetch, so it moves on with every refetch. */
function Updated({ page, now }: { page: PageListItem; now: number }) {
  return (
    <RelativeTime
      iso={page.updatedAt}
      now={now}
      suffix={page.updatedBy ? ` · ${page.updatedBy.name}` : undefined}
    />
  )
}

/**
 * Pages › "New page" (page:create): opens the new page dialog, also when
 * reached as /admin/pages?new=1 (⌘K "New page").
 */
export function NewPageButton() {
  const canCreate = usePermission({ page: ["create"] })
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const requested = searchParams.get("new") === "1"
  const [open, setOpen] = useState(false)
  if (!canCreate) return null
  const shown = open || requested
  return (
    <>
      <Button
        type="button"
        className={PRIMARY_ACTION}
        onClick={() => setOpen(true)}
      >
        <FilePlus2 aria-hidden />
        New page
      </Button>
      <NewPageDialog
        open={shown}
        onOpenChange={(next) => {
          setOpen(next)
          // Closing drops ?new=1, so Back / reload do not reopen it.
          if (!next && requested) router.replace(pathname, { scroll: false })
        }}
      />
    </>
  )
}

/** Site pages (the eight fixed pages) and Custom pages (/p/<slug>). */
export function PagesList() {
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="pages-site" className="flex flex-col gap-4">
        <h2 id="pages-site" className="text-card-title">
          Site pages
        </h2>
        <SitePagesList />
      </section>
      <section aria-labelledby="pages-custom" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="pages-custom" className="text-card-title">
            Custom pages
          </h2>
          <p className="text-sm text-muted-foreground">
            Pages built from blocks, at /p/ addresses.
          </p>
        </div>
        <CustomPagesList />
      </section>
    </div>
  )
}

const customStateOf = (page: BuilderPageListItem) => ({
  published: page.status === "published" ? true : null,
  dirty: page.hasUnpublishedChanges,
})

function CustomUpdated({
  page,
  now,
}: {
  page: BuilderPageListItem
  now: number
}) {
  return (
    <RelativeTime
      iso={page.updatedAt}
      now={now}
      suffix={page.updatedByName ? ` · ${page.updatedByName}` : undefined}
    />
  )
}

/** Builder pages: same card table / cards as the site pages. */
function CustomPagesList() {
  const canCreate = usePermission({ page: ["create"] })
  const pages = useQuery({
    queryKey: BUILDER_PAGES_KEY,
    queryFn: () => unwrap(api["builder-pages"].$get()),
  })
  if (pages.isPending)
    return (
      <div role="status">
        <span className="sr-only">Loading custom pages…</span>
        <CardSkeleton />
      </div>
    )
  if (pages.isError)
    return (
      <EmptyState
        role="alert"
        title="The custom pages didn't load"
        description={errorMessage(pages.error)}
        action={
          <Button
            type="button"
            className={FORM_ACTION}
            onClick={() => pages.refetch()}
          >
            Try again
          </Button>
        }
      />
    )
  const items = pages.data.items
  const now = pages.dataUpdatedAt
  if (items.length === 0)
    return (
      <EmptyState
        icon={FilePlus2}
        title="No custom pages yet"
        description={
          canCreate
            ? "Use New page to build one from blocks, or copy a site page from its editor."
            : "Pages built from blocks appear here."
        }
      />
    )
  return (
    <>
      <div
        data-slot="table-card"
        className="rounded-card hidden overflow-x-auto bg-card sm:block"
      >
        <Table>
          <TableCaption className="sr-only">Custom pages</TableCaption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className="text-muted-foreground">
                Title
              </TableHead>
              <TableHead scope="col" className="text-muted-foreground">
                Address
              </TableHead>
              <TableHead scope="col" className="text-muted-foreground">
                Status
              </TableHead>
              <TableHead scope="col" className="text-muted-foreground">
                Updated
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((page) => (
              <TableRow key={page.id} className="hover:bg-muted/40">
                <TableCell className="whitespace-normal">
                  <Link
                    href={`/admin/pages/custom/${page.id}`}
                    className="font-semibold underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {page.title}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-normal">
                  <code className="font-mono text-xs break-all text-muted-foreground">
                    {page.path}
                  </code>
                </TableCell>
                <TableCell className="whitespace-normal">
                  <ContentStatusPills record={customStateOf(page)} />
                </TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">
                  <CustomUpdated page={page} now={now} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul aria-label="Custom pages" className="flex flex-col gap-3 sm:hidden">
        {items.map((page) => (
          <li key={page.id} className="rounded-card relative bg-card p-4">
            <div className="flex flex-col gap-2 text-sm">
              <Link
                href={`/admin/pages/custom/${page.id}`}
                className="after:rounded-card font-semibold outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
              >
                {page.title}
              </Link>
              <code className="font-mono text-xs break-all text-muted-foreground">
                {page.path}
              </code>
              <ContentStatusPills record={customStateOf(page)} />
              <p className="text-xs text-muted-foreground">
                Updated <CustomUpdated page={page} now={now} />
              </p>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

/** The eight fixed pages (JW pages list): card table ≥ 640 px, cards below. */
function SitePagesList() {
  const pages = useQuery({
    queryKey: ["pages"],
    queryFn: () => unwrap(api.pages.$get()),
  })
  if (pages.isPending)
    return (
      <div role="status">
        <span className="sr-only">Loading pages…</span>
        <CardSkeleton />
      </div>
    )
  if (pages.isError)
    return (
      <EmptyState
        role="alert"
        title="The pages didn't load"
        description={errorMessage(pages.error)}
        action={
          <Button
            type="button"
            className={FORM_ACTION}
            onClick={() => pages.refetch()}
          >
            Try again
          </Button>
        }
      />
    )
  const items = pages.data.items
  const now = pages.dataUpdatedAt
  if (items.length === 0)
    return (
      <EmptyState
        icon={FileText}
        title="No pages yet"
        description="The site's pages appear here once the content is seeded."
      />
    )
  return (
    <>
      <div
        data-slot="table-card"
        className="rounded-card hidden overflow-x-auto bg-card sm:block"
      >
        <Table>
          <TableCaption className="sr-only">Pages</TableCaption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className="text-muted-foreground">
                Title
              </TableHead>
              <TableHead scope="col" className="text-muted-foreground">
                Address
              </TableHead>
              <TableHead scope="col" className="text-muted-foreground">
                Status
              </TableHead>
              <TableHead scope="col" className="text-muted-foreground">
                Updated
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((page) => (
              <TableRow key={page.key} className="hover:bg-muted/40">
                <TableCell className="whitespace-normal">
                  <Link
                    href={`/admin/pages/${page.key}`}
                    className="font-semibold underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {page.label}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-normal">
                  <code className="font-mono text-xs text-muted-foreground">
                    {page.path}
                  </code>
                </TableCell>
                <TableCell className="whitespace-normal">
                  <ContentStatusPills record={stateOf(page)} />
                </TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">
                  <Updated page={page} now={now} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul aria-label="Pages" className="flex flex-col gap-3 sm:hidden">
        {items.map((page) => (
          <li key={page.key} className="rounded-card relative bg-card p-4">
            <div className="flex flex-col gap-2 text-sm">
              <Link
                href={`/admin/pages/${page.key}`}
                className="after:rounded-card font-semibold outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
              >
                {page.label}
              </Link>
              <code className="font-mono text-xs text-muted-foreground">
                {page.path}
              </code>
              <ContentStatusPills record={stateOf(page)} />
              <p className="text-xs text-muted-foreground">
                Updated <Updated page={page} now={now} />
              </p>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
