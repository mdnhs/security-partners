"use client"

import {
  BriefcaseBusiness,
  Building2,
  ChartColumn,
  Contact,
  Handshake,
  Info,
  LayoutGrid,
  type LucideIcon,
  MailPlus,
  MapPin,
  Megaphone,
  Newspaper,
  PanelTop,
  Plus,
  ShieldCheck,
  Type,
  Users,
} from "lucide-react"
import { useId, useState } from "react"

import { COARSE_HEIGHT } from "@/components/admin/page-header"
import { BLOCKS, type BlockType } from "@/blocks/registry"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Item } from "@/components/ui/item"
import { cn } from "@/lib/utils"

import { type DraftDocumentValue, unavailableReason } from "./builder-state"

/** lucide icons named by blocks/registry `icon` (registry test pins coverage). */
export const BLOCK_ICONS: Readonly<Record<string, LucideIcon>> = {
  PanelTop,
  Info,
  ChartColumn,
  LayoutGrid,
  BriefcaseBusiness,
  ShieldCheck,
  Megaphone,
  Handshake,
  Users,
  Newspaper,
  Building2,
  Contact,
  MapPin,
  Type,
  MailPlus,
}

/**
 * "Add block": every block type with its icon, label and description.
 * Types the page cannot take (one per page, page full) stay listed but
 * unavailable, with the reason as text (focusable, aria-disabled).
 */
export function BlockLibrary({
  available,
  onAdd,
  doc,
  disabled = false,
}: {
  available: BlockType[]
  onAdd(type: BlockType): void
  /** For the "page is full" reason. */
  doc?: DraftDocumentValue
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const offered = new Set(available)
  return (
    <>
      <Button
        type="button"
        className={COARSE_HEIGHT}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden />
        Add block
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-4 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add a block</DialogTitle>
            <DialogDescription>
              Each block is a section of the public site. It is added after the
              selected block.
            </DialogDescription>
          </DialogHeader>
          <ul
            aria-label="Blocks"
            className="-mx-1 grid max-h-[60vh] gap-2 overflow-y-auto p-1 sm:grid-cols-2"
          >
            {BLOCKS.map((def) => {
              const Icon = BLOCK_ICONS[def.icon]
              const can = offered.has(def.type)
              const base = `${id}-${def.type.replace(/\W/g, "-")}`
              return (
                <li key={def.type}>
                  <Item
                    variant="outline"
                    className={cn(
                      "h-full min-h-11 flex-nowrap items-start text-left",
                      can
                        ? "hover:border-primary hover:bg-accent/40"
                        : "cursor-not-allowed bg-muted/40"
                    )}
                    render={
                      <button
                        type="button"
                        aria-labelledby={`${base}-label`}
                        aria-describedby={
                          can ? `${base}-desc` : `${base}-desc ${base}-reason`
                        }
                        aria-disabled={can ? undefined : true}
                        onClick={() => {
                          if (!can) return
                          onAdd(def.type)
                          setOpen(false)
                        }}
                      />
                    }
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-md",
                        can
                          ? "bg-accent text-accent-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {Icon ? <Icon className="size-4" /> : null}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span id={`${base}-label`} className="font-medium">
                        {def.label}
                      </span>
                      <span
                        id={`${base}-desc`}
                        className="text-xs text-muted-foreground"
                      >
                        {def.description}
                      </span>
                      {can ? null : (
                        <span
                          id={`${base}-reason`}
                          className="text-xs font-medium text-foreground"
                        >
                          {unavailableReason(def.type, doc)}
                        </span>
                      )}
                    </span>
                  </Item>
                </li>
              )
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}
