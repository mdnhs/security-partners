"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const subscribe = () => () => {}

/**
 * The admin theme. The saved choice only exists in the browser, so this
 * renders after mount (server and client never disagree on the pressed item).
 */
export function ThemePreference() {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
  const { theme, setTheme } = useTheme()
  if (!mounted) return <Skeleton className="bg-skeleton h-10 w-64" />
  return (
    <ToggleGroup
      aria-label="Theme"
      value={[theme ?? "system"]}
      onValueChange={(value) => {
        if (value[0]) setTheme(String(value[0]))
      }}
      variant="outline"
      size="lg"
      className="[&_[data-slot=toggle-group-item]]:h-10 [&_[data-slot=toggle-group-item]]:rounded-xl [&_[data-slot=toggle-group-item]]:px-4 [&_[data-slot=toggle-group-item]]:pointer-coarse:h-11"
    >
      <ToggleGroupItem value="light">
        <Sun aria-hidden /> Light
      </ToggleGroupItem>
      <ToggleGroupItem value="dark">
        <Moon aria-hidden /> Dark
      </ToggleGroupItem>
      <ToggleGroupItem value="system">
        <Monitor aria-hidden /> System
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
