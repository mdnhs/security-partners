"use client"

import { useQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown, UserRound } from "lucide-react"
import { useId, useState } from "react"

import { FILTER_CONTROL, FILTER_LABEL } from "@/components/admin/filter-field"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import { cn } from "@/lib/utils"

export type PickedUser = { id: string; name: string; email: string }

/**
 * Searchable user combobox (JW combobox pattern: trigger + popover +
 * command list) querying GET /users?q= as you type. Needs `user:read`.
 */
export function UserPicker({
  id,
  label,
  value,
  onChange,
  anyLabel = "Anyone",
  className,
}: {
  id: string
  label: string
  /** The chosen user's id; "" for no filter. */
  value: string
  onChange: (user: PickedUser | null) => void
  /** The "no filter" choice. */
  anyLabel?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<PickedUser | null>(null)
  const [search, setSearch] = useState("")
  const q = useDebouncedValue(search.trim(), 250)
  const listId = useId()
  const users = useQuery({
    queryKey: ["users", "picker", q],
    enabled: open,
    staleTime: 30_000,
    queryFn: async () =>
      (
        await unwrap(
          api.users.$get({
            query: {
              page: "1",
              pageSize: "20",
              sort: "name:asc",
              q: q || undefined,
            },
          })
        )
      ).items,
  })
  const current = value && picked?.id === value ? picked : null
  const searching = search.trim() !== q || users.isFetching

  function pick(user: PickedUser | null) {
    setPicked(user)
    onChange(user)
    setOpen(false)
    setSearch("")
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className={FILTER_LABEL}>
        {label}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              id={id}
              type="button"
              role="combobox"
              aria-expanded={open}
              aria-haspopup="listbox"
              aria-controls={open ? listId : undefined}
              className={cn(
                FILTER_CONTROL,
                "flex w-56 items-center justify-between gap-2 text-left"
              )}
            />
          }
        >
          <span className={cn("truncate", !current && "text-muted-foreground")}>
            {current ? current.name : anyLabel}
          </span>
          <ChevronsUpDown
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground"
          />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 gap-0 p-0">
          <Command shouldFilter={false} label="Search people">
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search by name or email"
            />
            <CommandList id={listId} label="People">
              {users.isError ? (
                <p role="alert" className="px-2 py-3 text-sm text-destructive">
                  {errorMessage(users.error)}
                </p>
              ) : (
                <CommandEmpty>
                  {searching ? "Searching…" : "Nobody matches."}
                </CommandEmpty>
              )}
              {!q ? (
                <CommandGroup>
                  <CommandItem
                    value="__anyone__"
                    data-checked={!current}
                    onSelect={() => pick(null)}
                  >
                    <UserRound aria-hidden />
                    {anyLabel}
                  </CommandItem>
                </CommandGroup>
              ) : null}
              {users.data?.length ? (
                <CommandGroup>
                  {users.data.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={user.id}
                      data-checked={current?.id === user.id}
                      onSelect={() =>
                        pick({
                          id: user.id,
                          name: user.name,
                          email: user.email,
                        })
                      }
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{user.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </span>
                      {current?.id === user.id ? (
                        <Check aria-hidden className="ml-auto" />
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
