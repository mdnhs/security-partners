"use client"

import { Copy, Eye, EyeOff, Trash2 } from "lucide-react"
import { useRef, useState } from "react"

import { COARSE_ICON } from "@/components/admin/page-header"
import {
  SortableList,
  type SortableItem,
} from "@/components/admin/sortable-list"
import { BLOCK_BY_TYPE, type BlockType } from "@/blocks/registry"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { BLOCK_ICONS } from "./block-library"
import {
  addableTypes,
  type DocAction,
  type DraftBlock,
  type DraftDocumentValue,
  firstMovable,
  selectAfterRemove,
} from "./builder-state"

type OutlineItem = SortableItem & { block: DraftBlock }

const problems = (n: number) => `${n} ${n === 1 ? "problem" : "problems"}`

/**
 * The page's blocks in order (spec §7.5). Reorder by drag, by keyboard
 * (space, arrows, space; announced) or Move up / Move down; per row:
 * select, hide (aria-pressed), duplicate and delete (confirmed). The page
 * hero stays first. `errors` = errorsByBlock (block id → messages).
 */
export function BlockOutline({
  doc,
  selectedId,
  errors,
  onSelect,
  dispatch,
  readOnly,
}: {
  doc: DraftDocumentValue
  selectedId: string | null
  errors: Record<string, string[]>
  onSelect(id: string): void
  dispatch(a: DocAction): void
  readOnly: boolean
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const [deleting, setDeleting] = useState<OutlineItem | null>(null)
  const counts = new Map<BlockType, number>()
  for (const block of doc.blocks)
    counts.set(block.type, (counts.get(block.type) ?? 0) + 1)
  const canAdd = new Set(addableTypes(doc))
  // Two blocks of one type are told apart by their anchor.
  const items: OutlineItem[] = doc.blocks.map((block) => {
    const label = BLOCK_BY_TYPE[block.type].label
    return {
      id: block.id,
      block,
      label:
        (counts.get(block.type) ?? 0) > 1
          ? `${label} (#${block.anchor})`
          : label,
    }
  })
  const fixedLeading = firstMovable(doc)

  const focusBlock = (id: string | null) =>
    requestAnimationFrame(() =>
      (id
        ? listRef.current?.querySelector<HTMLElement>(
            `[data-block-select="${id}"]`
          )
        : listRef.current
      )?.focus()
    )

  function confirmDelete() {
    if (!deleting) return
    const id = deleting.id
    const next = selectAfterRemove(doc, id)
    dispatch({ type: "remove", id })
    if (id === selectedId && next) onSelect(next)
    setDeleting(null)
    focusBlock(next)
  }

  if (doc.blocks.length === 0)
    return (
      <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        No blocks yet. Add one to start the page.
      </p>
    )

  return (
    <div ref={listRef} tabIndex={-1} className="outline-none">
      <SortableList
        label="Blocks"
        items={items}
        disabled={readOnly}
        fixedLeading={fixedLeading}
        onMove={(id, to) => dispatch({ type: "move", id, to })}
        rowClassName={(item) =>
          cn(
            item.id === selectedId && "border-primary ring-1 ring-primary",
            errors[item.id]?.length && "border-destructive"
          )
        }
        renderContent={(item) => {
          const { block } = item
          const def = BLOCK_BY_TYPE[block.type]
          const Icon = BLOCK_ICONS[def.icon]
          const count = errors[block.id]?.length ?? 0
          return (
            <button
              type="button"
              data-block-select={block.id}
              aria-current={block.id === selectedId ? "true" : undefined}
              aria-label={[
                def.label,
                `#${block.anchor}`,
                block.hidden ? "hidden" : null,
                count ? problems(count) : null,
              ]
                .filter(Boolean)
                .join(", ")}
              className="flex min-h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:min-h-11"
              onClick={() => onSelect(block.id)}
            >
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
              >
                {Icon ? <Icon className="size-3.5" /> : null}
              </span>
              <span
                className={cn(
                  "flex min-w-0 flex-col",
                  block.hidden && "text-muted-foreground"
                )}
              >
                <span className="truncate text-sm font-medium">
                  {def.label}
                </span>
                <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                  <span className="truncate font-mono">#{block.anchor}</span>
                  {block.hidden ? <span>· Hidden</span> : null}
                </span>
              </span>
              {count ? (
                <span className="ml-auto shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                  {problems(count)}
                </span>
              ) : null}
            </button>
          )
        }}
        actions={(item) => {
          if (readOnly) return null
          const { block } = item
          const duplicable = canAdd.has(block.type)
          return (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={COARSE_ICON}
                aria-label={`Hide ${item.label}`}
                aria-pressed={block.hidden}
                onClick={() =>
                  dispatch({
                    type: "meta",
                    id: block.id,
                    patch: { hidden: !block.hidden },
                  })
                }
              >
                {block.hidden ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={COARSE_ICON}
                aria-label={`Duplicate ${item.label}`}
                disabled={!duplicable}
                title={duplicable ? undefined : "Only one per page"}
                onClick={() => dispatch({ type: "duplicate", id: block.id })}
              >
                <Copy aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={cn(
                  COARSE_ICON,
                  "hover:bg-destructive/10 hover:text-destructive"
                )}
                aria-label={`Delete ${item.label}`}
                onClick={() => setDeleting(item)}
              >
                <Trash2 aria-hidden />
              </Button>
            </>
          )
        }}
      />
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              The block and its content leave the draft. The published page
              keeps it until you publish again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep block</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              onClick={confirmDelete}
            >
              Delete block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
