"use client"

import { useQuery } from "@tanstack/react-query"
import {
  Building2,
  ExternalLink,
  FileText,
  Plus,
  Search,
  ShieldCheck,
  Tags,
  Users,
  Wrench,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { useAdminSession } from "@/components/admin/session-provider"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { usePermission } from "@/hooks/use-permission"
import { api, unwrap } from "@/lib/api-client"
import type { SearchType } from "@/lib/schemas/api/search"

import { navItems } from "./nav"

const TYPE_ICONS: Record<SearchType, typeof FileText> = {
  page: FileText,
  service: Wrench,
  team: Users,
  client: ShieldCheck,
  groupCompany: Building2,
  category: Tags,
}

const TYPE_LABELS: Record<SearchType, string> = {
  page: "Page",
  service: "Service",
  team: "Team member",
  client: "Client",
  groupCompany: "Group company",
  category: "Category",
}

/** True for ⌘K (macOS) / Ctrl+K (elsewhere). */
export function isPaletteShortcut(event: KeyboardEvent): boolean {
  return (
    event.key.toLowerCase() === "k" &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey
  )
}

/**
 * ⌘K palette (spec §8.2): jump to a section, run a quick action or open a
 * record found by the search API. Renders its own topbar trigger.
 */
export function CommandPalette() {
  const router = useRouter()
  const { roles } = useAdminSession()
  const canCreateService = usePermission({ service: ["create"] })
  const canEditPages = usePermission({ page: ["update"] })
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const q = useDebouncedValue(query.trim(), 200)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isPaletteShortcut(event)) return
      event.preventDefault()
      setOpen((value) => !value)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const results = useQuery({
    queryKey: ["search", q],
    queryFn: () => unwrap(api.search.$get({ query: { q } })),
    enabled: open && q.length >= 2,
    staleTime: 10_000,
  })

  const needle = query.trim().toLowerCase()
  const sections = navItems(roles)
    .flatMap((section) => section.items)
    .filter((item) => !needle || item.label.toLowerCase().includes(needle))
  const actions = [
    canEditPages && {
      id: "edit-home",
      label: "Edit the home page",
      icon: FileText,
      run: () => router.push("/admin/pages/home"),
    },
    canCreateService && {
      id: "new-service",
      label: "New service",
      icon: Plus,
      run: () => router.push("/admin/services/new"),
    },
    {
      id: "open-site",
      label: "Open the public site",
      icon: ExternalLink,
      run: () => window.open("/", "_blank", "noopener"),
    },
  ].filter(
    (a): a is Exclude<typeof a, false> =>
      !!a && (!needle || a.label.toLowerCase().includes(needle))
  )

  function go(run: () => void) {
    setOpen(false)
    setQuery("")
    run()
  }

  const records = results.data?.items ?? []
  const searching = q.length >= 2 && results.isFetching

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-full max-w-sm justify-start gap-2 text-muted-foreground max-sm:w-auto max-sm:border-transparent"
      >
        <Search aria-hidden />
        <span className="max-sm:sr-only">Search…</span>
        <Kbd className="ml-auto max-sm:hidden">⌘K</Kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setQuery("")
        }}
        title="Search the admin"
        description="Jump to a section, run an action or find a page, service or team member."
      >
        {/* Server results are already filtered: cmdk must not filter again. */}
        <Command shouldFilter={false} label="Search">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search pages, services, team… or type a section"
          />
          <CommandList>
            <CommandEmpty>
              {searching ? "Searching…" : `No results for “${query.trim()}”.`}
            </CommandEmpty>
            {records.length > 0 ? (
              <CommandGroup heading="Records">
                {records.map((record) => {
                  const Icon = TYPE_ICONS[record.type]
                  return (
                    <CommandItem
                      key={`${record.type}:${record.id}`}
                      value={`${record.type}:${record.id}`}
                      onSelect={() => go(() => router.push(record.href))}
                    >
                      <Icon aria-hidden />
                      <span className="truncate">{record.title}</span>
                      <span className="ml-auto truncate text-xs text-muted-foreground">
                        {TYPE_LABELS[record.type]}
                        {record.subtitle ? ` · ${record.subtitle}` : ""}
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ) : null}
            {sections.length > 0 ? (
              <CommandGroup heading="Go to">
                {sections.map((item) => {
                  const Icon = item.icon
                  return (
                    <CommandItem
                      key={item.href}
                      value={`nav:${item.href}`}
                      onSelect={() => go(() => router.push(item.href))}
                    >
                      <Icon aria-hidden />
                      {item.label}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ) : null}
            {actions.length > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Actions">
                  {actions.map((action) => {
                    const Icon = action.icon
                    return (
                      <CommandItem
                        key={action.id}
                        value={`action:${action.id}`}
                        onSelect={() => go(action.run)}
                      >
                        <Icon aria-hidden />
                        {action.label}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
