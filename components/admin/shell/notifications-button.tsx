"use client"

import { Bell, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { ShellNotification } from "@/lib/schemas/api/dashboard"

import { ICON_BUTTON } from "./constants"

/**
 * The bell (final review I6): what needs someone now, from the panel
 * layout (server; fresh on every navigation and router.refresh()): new
 * unassigned leads, and for integration readers the spam-protection
 * warning and failed background jobs. Each item links to where it is fixed.
 */
export function NotificationsButton({
  items = [],
}: {
  items?: readonly ShellNotification[]
}) {
  const [open, setOpen] = useState(false)
  const count = items.length
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="icon-lg"
            className={`${ICON_BUTTON} relative`}
            aria-label={
              count
                ? `Notifications, ${count} need${count === 1 ? "s" : ""} attention`
                : "Notifications"
            }
          />
        }
      >
        <Bell aria-hidden />
        {count ? (
          <span
            aria-hidden
            data-slot="notification-dot"
            className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-destructive ring-2 ring-sidebar"
          />
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <PopoverHeader className="border-b px-4 py-3">
          <PopoverTitle>Notifications</PopoverTitle>
        </PopoverHeader>
        <div className="max-h-80 overflow-y-auto">
          {count ? (
            <ul className="flex flex-col py-1">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-start gap-3 px-4 py-3 text-sm outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-semibold">{item.title}</span>
                      <span className="wrap-anywhere text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                    <ChevronRight
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              You&apos;re all caught up
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
