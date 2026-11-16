import {
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Info,
  Lightbulb,
  TriangleAlert,
} from "lucide-react"
import Link from "next/link"

import { FormCard } from "@/components/admin/form/form-ui"
import { LINK_SECONDARY } from "@/components/admin/page-header"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import {
  canFollow,
  groupedArticles,
  HELP_GROUPS,
  HELP_GUIDES,
  HELP_HREF,
  HELP_SHORTCUTS,
  headingId,
  type HelpArticle,
  type HelpBlock,
  helpArticle,
  helpHref,
  neighbours,
  tocFor,
} from "@/lib/admin/help/registry"
import { cn } from "@/lib/utils"

import { HELP_GROUP_ICONS } from "./help-icons"
import { HelpMobileNav } from "./help-mobile-nav"
import { type HelpNavGroup, HelpSidebar } from "./help-sidebar"
import { HelpToc, HelpTocDisclosure } from "./help-toc"
import { HelpText } from "./inline"

export type OwnerContact = { name: string; email: string }

function navGroups(roles: readonly string[]): HelpNavGroup[] {
  return groupedArticles(roles).map((group) => ({
    id: group.id,
    label: group.label,
    articles: group.articles.map(({ slug, title }) => ({ slug, title })),
  }))
}

/**
 * Three columns like a docs site: topics (~17rem), the page, and "On this
 * page" (~14rem). HelpShell (the topics) is rendered by help/layout.tsx, so
 * it stays mounted across articles; each page brings its own TOC column.
 * The side columns stick, with their own scroll, while <main> scrolls.
 */
export function HelpShell({
  roles,
  children,
}: {
  roles: readonly string[]
  children: React.ReactNode
}) {
  const groups = navGroups(roles)
  return (
    <div
      data-testid="help"
      className="grid gap-8 lg:grid-cols-[17rem_minmax(0,1fr)]"
    >
      <aside className="sticky top-0 hidden max-h-(--content-h) self-start overflow-y-auto overscroll-contain pr-2 pb-6 lg:block">
        <HelpSidebar groups={groups} />
      </aside>
      <div className="flex min-w-0 flex-col gap-6">
        <HelpMobileNav groups={groups} />
        {children}
      </div>
    </div>
  )
}

function HelpPage({
  aside,
  children,
}: {
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  if (!aside) return <>{children}</>
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_14rem]">
      <div className="min-w-0">{children}</div>
      <aside className="sticky top-0 hidden max-h-(--content-h) self-start overflow-y-auto pb-6 xl:block">
        {aside}
      </aside>
    </div>
  )
}

const CALLOUT = {
  tip: {
    label: "Tip",
    Icon: Lightbulb,
    tone: "border-primary/30 bg-accent/60",
  },
  note: { label: "Note", Icon: Info, tone: "border-border bg-card" },
  warning: {
    label: "Warning",
    Icon: TriangleAlert,
    tone: "border-destructive/40 bg-destructive/5",
  },
} as const

function Block({
  block,
  roles,
}: {
  block: HelpBlock
  roles: readonly string[]
}) {
  switch (block.type) {
    case "p":
      return (
        <p className="leading-7 text-muted-foreground">
          <HelpText text={block.text} roles={roles} />
        </p>
      )
    case "list":
      return (
        <ul className="ml-5 flex list-disc flex-col gap-2 leading-7 text-muted-foreground marker:text-primary">
          {block.items.map((item) => (
            <li key={item}>
              <HelpText text={item} roles={roles} />
            </li>
          ))}
        </ul>
      )
    case "steps":
      return (
        <ol className="flex flex-col gap-3">
          {block.items.map((item, index) => (
            <li
              key={item}
              className="flex gap-3 leading-7 text-muted-foreground"
            >
              <span
                aria-hidden
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
              >
                {index + 1}
              </span>
              <span className="min-w-0">
                <HelpText text={item} roles={roles} />
              </span>
            </li>
          ))}
        </ol>
      )
    case "callout": {
      const { label, Icon, tone } = CALLOUT[block.tone]
      return (
        <div
          role="note"
          aria-label={label}
          className={cn("flex gap-3 rounded-xl border p-4 leading-7", tone)}
        >
          <Icon aria-hidden className="mt-1 size-4 shrink-0 text-primary" />
          <p className="min-w-0 text-foreground/90">
            <span className="font-semibold">{label}: </span>
            <HelpText text={block.text} roles={roles} />
          </p>
        </div>
      )
    }
    case "open":
      // A button to a screen the viewer cannot open is left out.
      return canFollow(roles, block.href) ? (
        <p>
          <Link href={block.href} className={cn(LINK_SECONDARY, "h-11")}>
            {block.label}
            <ArrowUpRight aria-hidden />
          </Link>
        </p>
      ) : null
  }
}

function groupLabel(article: HelpArticle) {
  return HELP_GROUPS.find((group) => group.id === article.group)!.label
}

export function HelpArticleView({
  article,
  roles,
}: {
  article: HelpArticle
  roles: readonly string[]
}) {
  const { prev, next } = neighbours(roles, article.slug)
  const toc = tocFor(article)
  return (
    <HelpPage aside={<HelpToc entries={toc} />}>
      <article className="flex max-w-[70ch] flex-col gap-10">
        <header className="flex flex-col gap-3">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href={HELP_HREF} />}>
                  Help
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>{groupLabel(article)}</BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{article.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-title text-balance">{article.title}</h1>
          <p className="text-lg leading-8 text-muted-foreground">
            <HelpText text={article.lead} roles={roles} />
          </p>
        </header>
        <HelpTocDisclosure entries={toc} />
        {article.sections.map((section) => {
          const id = headingId(section.title)
          return (
            <section
              key={id}
              aria-labelledby={id}
              className={cn(
                "flex flex-col gap-4",
                section.level === 3 && "-mt-4"
              )}
            >
              {section.level === 3 ? (
                <h3
                  id={id}
                  className="scroll-mt-6 text-lg font-semibold tracking-tight"
                >
                  {section.title}
                </h3>
              ) : (
                <h2
                  id={id}
                  className="scroll-mt-6 border-b border-border pb-2 text-xl font-semibold tracking-tight"
                >
                  {section.title}
                </h2>
              )}
              {section.blocks.map((block, index) => (
                <Block key={index} block={block} roles={roles} />
              ))}
            </section>
          )
        })}
        <nav
          aria-label="Pagination"
          className="flex items-start justify-between gap-6 border-t border-border py-8"
        >
          {prev ? (
            <PagerLink article={prev} direction="prev" />
          ) : (
            <span aria-hidden />
          )}
          {next ? (
            <PagerLink article={next} direction="next" />
          ) : (
            <span aria-hidden />
          )}
        </nav>
      </article>
    </HelpPage>
  )
}

/**
 * Previous / Next in sidebar order, across groups: a chevron, a small label
 * and the title, no box. The chevron nudges outward on hover.
 */
function PagerLink({
  article,
  direction,
}: {
  article: HelpArticle
  direction: "prev" | "next"
}) {
  const isNext = direction === "next"
  const Chevron = isNext ? ChevronRight : ChevronLeft
  return (
    <Link
      href={helpHref(article.slug)}
      rel={direction}
      className={cn(
        "group flex min-w-0 items-center gap-3",
        isNext && "ml-auto flex-row-reverse text-right"
      )}
    >
      <Chevron
        aria-hidden
        className={cn(
          "size-5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
          isNext
            ? "group-hover:translate-x-0.5"
            : "group-hover:-translate-x-0.5"
        )}
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">
          {isNext ? "Next" : "Previous"}
        </span>{" "}
        <span className="font-semibold text-foreground underline-offset-4 group-hover:text-primary group-hover:underline">
          {article.title}
        </span>
      </span>
    </Link>
  )
}

/** Keyboard shortcuts, as on the old single Help page. */
function ShortcutsCard() {
  return (
    <FormCard id="help-shortcuts" title="Keyboard shortcuts">
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3 text-sm">
        {HELP_SHORTCUTS.map(({ keys, action }) => (
          <div key={action} className="contents">
            <dt className="flex flex-wrap items-center gap-1.5">
              {keys.map((combo, index) => (
                <span
                  key={combo.join("+")}
                  className="flex items-center gap-1.5"
                >
                  {index > 0 ? (
                    <span className="text-xs text-muted-foreground">or</span>
                  ) : null}
                  <KbdGroup>
                    {combo.map((key) => (
                      <Kbd key={key}>{key}</Kbd>
                    ))}
                  </KbdGroup>
                </span>
              ))}
            </dt>
            <dd className="text-foreground">{action}</dd>
          </div>
        ))}
      </dl>
    </FormCard>
  )
}

/** The active owners to mail for access or a reset. */
function ContactCard({ owners }: { owners: readonly OwnerContact[] }) {
  return (
    <FormCard
      id="help-contact"
      title="Who to contact"
      description="Owners can invite people, change roles and reset access."
    >
      {owners.length > 0 ? (
        <ul className="flex flex-col gap-3 text-sm">
          {owners.map((owner) => (
            <li key={owner.email} className="flex min-w-0 flex-col">
              <span className="font-semibold text-foreground">
                {owner.name}
              </span>
              {/* 44 px tall on coarse pointers; the inner span truncates. */}
              <a
                href={`mailto:${owner.email}`}
                className="inline-flex w-fit max-w-full items-center text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none pointer-coarse:min-h-11"
              >
                <span className="truncate">{owner.email}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          There is no active owner yet. Ask whoever set up the site.
        </p>
      )}
    </FormCard>
  )
}

/** The runbook's sections by title (the runbook is not served by the site). */
function GuidesCard() {
  return (
    <FormCard
      id="help-guides"
      title="Guides"
      description="In the operations runbook (docs/runbook.md) kept with the site's code."
      className="xl:col-span-2"
    >
      <ul className="grid list-disc gap-2 pl-5 text-sm text-foreground sm:grid-cols-2">
        {HELP_GUIDES.map((guide) => (
          <li key={guide}>{guide}</li>
        ))}
      </ul>
    </FormCard>
  )
}

/**
 * /admin/help: the "New here?" card, a card per topic group (only the
 * articles the viewer's roles may read), then the shortcuts, the owners to
 * contact and the runbook's guides.
 */
export function HelpOverview({
  roles,
  owners,
}: {
  roles: readonly string[]
  owners: readonly OwnerContact[]
}) {
  const start = helpArticle("getting-started")!
  const groups = groupedArticles(roles)
  return (
    <div className="flex flex-col gap-8">
      <header className="flex max-w-3xl flex-col gap-3">
        <h1 className="text-title text-balance">Help</h1>
        <p className="text-lg leading-8 text-muted-foreground">
          Step-by-step guides for every part of the admin. Only the parts your
          role can open are listed.
        </p>
      </header>
      <Link
        href={helpHref(start.slug)}
        className="rounded-card flex flex-col gap-2 bg-primary p-6 text-primary-foreground transition-opacity hover:opacity-95 sm:p-8"
      >
        <span className="text-sm font-semibold tracking-wide uppercase opacity-80">
          New here?
        </span>
        <span className="text-2xl font-semibold">{start.title}</span>
        <span className="max-w-2xl opacity-90">{start.description}</span>
        <span className="mt-2 inline-flex items-center gap-1 font-semibold">
          Read the guide <ArrowRight aria-hidden className="size-4" />
        </span>
      </Link>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {groups.map((group) => {
          const Icon = HELP_GROUP_ICONS[group.id]
          return (
            <section
              key={group.id}
              aria-labelledby={`group-${group.id}`}
              className="rounded-card flex flex-col gap-4 border bg-card p-5 text-card-foreground sm:p-6"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground [&_svg]:size-5"
                >
                  <Icon />
                </span>
                <div className="min-w-0">
                  <h2 id={`group-${group.id}`} className="font-semibold">
                    {group.label}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {group.description}
                  </p>
                </div>
              </div>
              <ul className="flex flex-col gap-1">
                {group.articles.map((article) => (
                  <li key={article.slug}>
                    <Link
                      href={helpHref(article.slug)}
                      className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground pointer-coarse:min-h-11"
                    >
                      {article.title}
                      <ArrowRight
                        aria-hidden
                        className="size-4 opacity-0 transition-opacity group-hover:opacity-100"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ShortcutsCard />
        <ContactCard owners={owners} />
        <GuidesCard />
      </div>
    </div>
  )
}
