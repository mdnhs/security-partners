"use client"

import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

import {
  columnsFor,
  DataTable,
  type DataTableColumns,
} from "@/components/admin/data-table/data-table"
import {
  mergeListSearch,
  useUrlFilters,
} from "@/components/admin/data-table/list-url"
import { FilterSelect } from "@/components/admin/filter-field"
import { RelativeTime } from "@/components/admin/kit/relative-time"
import { StatusPill, toneForStatus } from "@/components/admin/kit/status-pill"
import { LINK_PRIMARY, PageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { usePermission } from "@/hooks/use-permission"
import {
  ARTICLE_STATUS_FILTERS,
  articleStatusLabel,
  parseStatusParam,
} from "@/lib/admin/article-status"
import { api, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import type { ArticleListItem } from "@/lib/schemas/api/articles"
import type { ContentStatus } from "@/lib/schemas/api/content"
import type { Paginated } from "@/lib/schemas/api/list"

type Row = ArticleListItem & Record<string, unknown>
const ch = columnsFor<Row>()

/** One pill per article: Draft, In review, Scheduled · when, Published, Unpublished changes. */
function ArticleStatusPill({ article }: { article: ArticleListItem }) {
  const badge = articleStatusLabel(article)
  // "Scheduled · 1 Jul 2099, 10:00" takes the tone of "Scheduled".
  const tone = toneForStatus(badge.text.split(" · ")[0]!)
  return <StatusPill tone={tone}>{badge.text}</StatusPill>
}

/** The status filter row: 40 px pills (44 px on touch), the active one filled. */
const STATUS_FILTER =
  "h-10 rounded-xl px-4 text-sm font-medium pointer-coarse:h-11 pointer-coarse:px-5"

// Column definitions live at module scope (TanStack Table v9 needs stable references).
const columns = ch.columns([
  ch.accessor("title", {
    header: "Article",
    cell: (info) => (
      <span className="flex min-w-0 flex-col">
        <Link
          href={`/admin/insights/${info.row.original.id}`}
          className="font-semibold underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {info.getValue()}
        </Link>
        <code className="font-mono text-xs text-muted-foreground">
          /blog/{info.row.original.slug}
        </code>
      </span>
    ),
  }),
  ch.display({
    id: "status",
    header: "Status",
    cell: ({ row }) => <ArticleStatusPill article={row.original} />,
  }),
  ch.display({
    id: "category",
    header: "Category",
    cell: ({ row }) => row.original.category.name,
  }),
  ch.display({
    id: "author",
    header: "Byline",
    cell: ({ row }) =>
      row.original.author?.name ?? (
        <span className="text-muted-foreground">None</span>
      ),
  }),
  ch.accessor("publishedAt", {
    header: "Published",
    cell: (info) => {
      const iso = info.getValue()
      return iso ? (
        <time
          dateTime={iso}
          className="whitespace-nowrap text-muted-foreground"
        >
          {formatDateTime(iso)}
        </time>
      ) : (
        <span className="text-muted-foreground">
          <span aria-hidden>—</span>
          <span className="sr-only">Not published</span>
        </span>
      )
    },
  }),
  ch.accessor("updatedAt", {
    header: "Updated",
    cell: (info) => (
      <span className="text-muted-foreground">
        <RelativeTime
          iso={info.getValue()}
          suffix={
            info.row.original.updatedBy
              ? ` · ${info.row.original.updatedBy.name}`
              : undefined
          }
        />
      </span>
    ),
  }),
]) as unknown as DataTableColumns<Row>

/** Articles (spec §8.1): status filters incl. the review queue, category, byline. */
export function ArticlesScreen() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const status = parseStatusParam(searchParams.get("status"))
  const canCreate = usePermission({ article: ["create"] })
  const canReview = usePermission({ article: ["publish"] })
  // Category and byline live in the URL too (?category=&author=).
  const [params, setParams] = useUrlFilters(["category", "author"] as const)
  const { category, author } = params
  const options = useQuery({
    queryKey: ["articles", "options"],
    queryFn: () => unwrap(api.articles.options.$get()),
  })
  const filters = {
    status: status ?? undefined,
    category: category || undefined,
    author: author || undefined,
  }
  const filterKey =
    status || category || author ? `${status ?? ""}|${category}|${author}` : ""
  const setStatus = (next: ContentStatus | null) => {
    // The other filters, the search and the sort stay; the page resets.
    const search = mergeListSearch(window.location.search, {
      status: next ?? undefined,
    })
    router.replace(`/admin/insights${search ? `?${search}` : ""}`, {
      scroll: false,
    })
  }
  const newArticle = canCreate ? (
    <Link href="/admin/insights/new" className={LINK_PRIMARY}>
      <Plus aria-hidden />
      New article
    </Link>
  ) : null

  return (
    <>
      <PageHeader
        title="Articles"
        description="Blog posts. Authors write drafts and submit them for review; editors publish them now or schedule them."
        actions={newArticle}
      />
      <div
        role="group"
        aria-label="Status"
        className="mb-4 flex flex-wrap gap-2"
      >
        {ARTICLE_STATUS_FILTERS.map((filter) => {
          const active = status === filter.value
          return (
            <Button
              key={filter.label}
              type="button"
              variant={active ? "default" : "outline"}
              className={STATUS_FILTER}
              aria-pressed={active}
              onClick={() => setStatus(filter.value)}
            >
              {filter.value === "in_review" && canReview
                ? "Review queue"
                : filter.label}
            </Button>
          )
        })}
      </div>
      <DataTable<Row>
        syncUrl
        label="Articles"
        queryKey={["articles", filters]}
        filterKey={filterKey}
        filteredEmpty={
          status === "in_review"
            ? "Nothing is waiting for review"
            : "No articles match these filters"
        }
        searchPlaceholder="Search titles and addresses"
        initialSort={[{ id: "updatedAt", desc: true }]}
        toolbar={
          <>
            <FilterSelect
              id="articles-category"
              label="Category"
              value={category}
              onChange={(value) => setParams({ category: value })}
              options={[
                { value: "", label: "All categories" },
                ...(options.data?.categories ?? []).map((c) => ({
                  value: c.id,
                  label: c.name,
                })),
              ]}
            />
            <FilterSelect
              id="articles-author"
              label="Byline"
              value={author}
              onChange={(value) => setParams({ author: value })}
              options={[
                { value: "", label: "Anyone" },
                { value: "me", label: "Me" },
                ...(options.data?.authors ?? []).map((a) => ({
                  value: a.id,
                  label: a.name,
                })),
              ]}
            />
          </>
        }
        fetchPage={async (params) =>
          (await unwrap(
            api.articles.$get({
              query: {
                page: String(params.page),
                pageSize: String(params.pageSize),
                sort: params.sort,
                q: params.q,
                status: filters.status,
                category: filters.category,
                author: filters.author,
              },
            })
          )) as Paginated<Row>
        }
        columns={columns}
        renderCard={(row) => (
          <div className="rounded-card relative flex flex-col gap-2 bg-card p-4">
            <span className="flex items-start justify-between gap-2">
              <Link
                href={`/admin/insights/${row.id}`}
                className="after:rounded-card font-semibold outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
              >
                {row.title}
              </Link>
              <ArticleStatusPill article={row} />
            </span>
            <code className="truncate font-mono text-xs text-muted-foreground">
              /blog/{row.slug}
            </code>
            <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>
                {row.category.name}
                {row.author ? ` · ${row.author.name}` : ""}
              </span>
              <span>
                Updated <RelativeTime iso={row.updatedAt} />
              </span>
            </span>
          </div>
        )}
        empty="No articles yet"
        emptyDescription="Articles appear on /blog once published. Drafts stay private until then."
        emptyAction={newArticle}
      />
    </>
  )
}
