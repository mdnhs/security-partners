"use client"

import { Menu } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

import { SidebarBrand, SidebarNav } from "./sidebar"

/** Below 1024 px the navigation lives in a left sheet (spec §8.2). */
export function MobileNav() {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation"
          />
        }
      >
        <Menu aria-hidden />
      </SheetTrigger>
      <SheetContent
        side="left"
        className="gap-6 overflow-y-auto border-sidebar-border bg-sidebar px-3 py-4 text-sidebar-foreground data-[side=left]:w-72 [&_[data-slot=sheet-close]]:text-sidebar-foreground"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Admin sections</SheetDescription>
        </SheetHeader>
        <SidebarBrand onNavigate={() => setOpen(false)} />
        <SidebarNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
