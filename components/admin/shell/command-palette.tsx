"use client"

import { useQuery } from "@tanstack/react-query"
import {
  Building2,
  ExternalLink,
  FileText,
  Inbox,
  LogOut,
  type LucideIcon,
  Monitor,
  Moon,
  Newspaper,
  Plus,
  ShieldCheck,
  Sun,
  Tags,
  UserCog,
  Users,
  Wrench,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useCallback, useEffect, useState } from "react"

import { useUnsavedRegistry } from "@/components/admin/editor/unsaved-guard"
import { useAdminSession } from "@/components/admin/session-provider"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { usePermission } from "@/hooks/use-permission"
import { HELP_LINK, NAV_ITEMS, reachableLinks } from "@/lib/admin/nav"
import { api, unwrap } from "@/lib/api-client"
import { hasPermission } from "@/lib/auth/permissions"
import type { SearchType } from "@/lib/schemas/api/search"

import { buildActions, matchesQuery } from "./palette-actions"
import { useCommandPalette } from "./palette-context"
import { useShellSignOut } from "./sign-out-context"

const TYPE_ICONS: Record<SearchType, typeof FileText> = {
  page: FileText,
  service: Wrench,
  article: Newspaper,
  team: Users,
  client: ShieldCheck,
  groupCompany: Building2,
  category: Tags,
  lead: Inbox,
}

const TYPE_LABELS: Record<SearchType, string> = {
  page: "Page",
  service: "Service",
  article: "Article",
  team: "Team member",
  client: "Client",
  groupCompany: "Group company",
  category: "Category",
  lead: "Lead",
}

const ACTION_ICONS: Record<string, LucideIcon> = {
  "new-article": Plus,
  "new-service": Plus,
  "open-site": ExternalLink,
  "theme-light": Sun,
  "theme-dark": Moon,
  "theme-system": Monitor,
  "sign-out": LogOut,
}

/** A section's own search terms, so its sub-pages answer to them too. */
const SECTION_KEYWORDS = new Map(
  NAV_ITEMS.map((item) => [item.label, item.keywords ?? []])
)

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
 * record found by the search API. Opened by the topbar's SearchPill or
 * ⌘/Ctrl+K.
 */
export function CommandPalette() {
  const router = useRouter()
  // Unsaved edits on the current page ask first (final review I3).
  const unsaved = useUnsavedRegistry()
  const navigate = (href: string) => {
    if (unsaved) void unsaved.navigate(href)
    else router.push(href)
  }
  const { roles } = useAdminSession()
  const canReadUsers = usePermission({ user: ["read"] })
  const { setTheme } = useTheme()
  const { signOut } = useShellSignOut()
  const { open, setOpen } = useCommandPalette()
  const [query, setQuery] = useState("")
  const trimmed = query.trim()
  const q = useDebouncedValue(trimmed, 200)

  /** Every open/close goes through here: a closed palette forgets its query. */
  const setPaletteOpen = useCallback(
    (next: boolean) => {
      setOpen(next)
      if (!next) setQuery("")
    },
    [setOpen]
  )

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // A focused widget that handles Mod-K itself (e.g. the rich-text
      // editor's link shortcut) prevents the default: it wins.
      if (event.defaultPrevented || !isPaletteShortcut(event)) return
      event.preventDefault()
      setPaletteOpen(!open)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, setPaletteOpen])

  // Records need 2+ characters; the input (not only the debounced value)
  // must ask for them, so a quickly reopened palette shows no stale results.
  const wantsRecords = trimmed.length >= 2
  const results = useQuery({
    queryKey: ["search", q],
    queryFn: () => unwrap(api.search.$get({ query: { q } })),
    enabled: open && wantsRecords && q.length >= 2,
    staleTime: 10_000,
  })
  // People (spec §8.2): the users list, name or email, for user:read holders.
  const people = useQuery({
    queryKey: ["users", "palette", q],
    queryFn: async () =>
      (
        await unwrap(
          api.users.$get({
            query: { q, page: "1", pageSize: "5", sort: "name:asc" },
          })
        )
      ).items,
    enabled: canReadUsers && open && wantsRecords && q.length >= 2,
    staleTime: 10_000,
  })

  // /admin/help is built in B7; until then ⌘K leaves it out (no 404).
  const sections = reachableLinks(roles)
    .filter((item) => item.href !== HELP_LINK.href)
    .filter((item) =>
      matchesQuery(trimmed, item.label, [
        ...(item.keywords ?? []),
        ...(item.parent
          ? [item.parent, ...(SECTION_KEYWORDS.get(item.parent) ?? [])]
          : []),
      ])
    )
  const actions = buildActions({
    setTheme,
    // From the menu: a failure shows in the user menu. Asks first while
    // something is unsaved (the shell's sign-out goes through confirmLeave).
    signOut: () => signOut("menu"),
    open: (href) => window.open(href, "_blank", "noopener,noreferrer"),
    can: (permission) => hasPermission(roles, permission),
    navigate,
  }).filter((action) => matchesQuery(trimmed, action.label, action.keywords))

  function go(run: () => void) {
    setPaletteOpen(false)
    run()
  }

  const records = (wantsRecords && results.data?.items) || []
  const found = (wantsRecords && canReadUsers && people.data) || []
  // The debounce window counts as searching: no flash of "No results".
  const searching =
    wantsRecords &&
    (trimmed !== q || results.isFetching || (canReadUsers && people.isFetching))
  // Only a failed record search is a failure; a failed People query drops
  // that group alone (the records still show).
  const failed = wantsRecords && !searching && results.isError

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={setPaletteOpen}
        title="Search the admin"
        description="Jump to a section, run an action or find a page, service, article or team member."
      >
        {/*
         * Server results are already filtered: cmdk must not filter again.
         * No vim bindings: cmdk's Ctrl+K ("previous item") would claim the
         * shortcut that closes the palette.
         */}
        <Command shouldFilter={false} vimBindings={false} label="Search">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search pages and actions…"
          />
          {/* Outside the listbox: a listbox may only own options and groups. */}
          {failed ? (
            <p
              role="alert"
              className="px-2 py-3 text-center text-sm text-destructive"
            >
              Search failed — try again
            </p>
          ) : null}
          <CommandList>
            {failed ? null : (
              <CommandEmpty>
                {searching ? "Searching…" : `No results for “${trimmed}”.`}
              </CommandEmpty>
            )}
            {sections.length > 0 ? (
              <CommandGroup heading="Go to">
                {sections.map((item) => {
                  const Icon = item.icon
                  return (
                    <CommandItem
                      key={item.href}
                      value={`nav:${item.href}`}
                      onSelect={() => go(() => navigate(item.href))}
                    >
                      <Icon aria-hidden />
                      {item.label}
                      {item.parent ? (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {item.parent}
                        </span>
                      ) : null}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ) : null}
            {records.length > 0 ? (
              <CommandGroup heading="Records">
                {records.map((record) => {
                  const Icon = TYPE_ICONS[record.type]
                  return (
                    <CommandItem
                      key={`${record.type}:${record.id}`}
                      value={`${record.type}:${record.id}`}
                      onSelect={() => go(() => navigate(record.href))}
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
            {found.length > 0 ? (
              <CommandGroup heading="People">
                {found.map((person) => (
                  <CommandItem
                    key={`user:${person.id}`}
                    value={`user:${person.id}`}
                    onSelect={() =>
                      go(() => navigate(`/admin/users/${person.id}`))
                    }
                  >
                    <UserCog aria-hidden />
                    <span className="truncate">{person.name}</span>
                    <span className="ml-auto truncate text-xs text-muted-foreground">
                      {person.email}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {actions.length > 0 ? (
              // A rule above, not a CommandSeparator: a role="separator" is
              // not an allowed child of the listbox (axe aria-required-children).
              <CommandGroup heading="Actions" className="border-t">
                {actions.map((action) => {
                  const Icon = ACTION_ICONS[action.id] ?? Plus
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
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
