"use client"

import { Bell } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"

import { ICON_BUTTON } from "./constants"

/** The bell. Phase 7 fills it (new leads); until then it is empty. */
export function NotificationsButton() {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="icon-lg"
            className={ICON_BUTTON}
            aria-label="Notifications"
          />
        }
      >
        <Bell aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <PopoverHeader className="border-b px-4 py-3">
          <PopoverTitle>Notifications</PopoverTitle>
        </PopoverHeader>
        <div className="max-h-80 overflow-y-auto">
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No notifications yet
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
