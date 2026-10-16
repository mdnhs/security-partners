"use client"

import { Search, SlidersHorizontal } from "lucide-react"
import { useSyncExternalStore } from "react"

import { Kbd, KbdGroup } from "@/components/ui/kbd"

import { useCommandPalette } from "./palette-context"

const subscribe = () => () => {}
const isApple = () => /Mac|iPhone|iPad/.test(navigator.userAgent)

/** The topbar's search pill with its ⌘K hint (server assumes ⌘). */
export function SearchPill() {
  const { setOpen } = useCommandPalette()
  const apple = useSyncExternalStore(subscribe, isApple, () => true)
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Search"
      aria-keyshortcuts="Meta+K Control+K"
      className="flex h-11 w-full max-w-sm min-w-0 items-center gap-3 rounded-full bg-card px-4 text-sm text-muted-foreground ring-1 ring-border transition-shadow outline-none hover:ring-ring/40 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Search aria-hidden className="size-4 shrink-0" />
      <span className="flex-1 truncate text-left">Search</span>
      <KbdGroup aria-hidden className="hidden sm:inline-flex">
        <Kbd>{apple ? "⌘" : "Ctrl"}</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
      <SlidersHorizontal aria-hidden className="size-4 shrink-0" />
    </button>
  )
}
