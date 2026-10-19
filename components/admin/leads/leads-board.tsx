"use client"

import {
  type Announcements,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardCode,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  type UniqueIdentifier,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { MoveRight } from "lucide-react"
import {
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
  useId,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"

import { initials } from "@/components/admin/kit/format"
import { RelativeTime } from "@/components/admin/kit/relative-time"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  LEAD_STATUS_LABELS,
  type LeadListItem,
  type LeadStatus,
} from "@/lib/schemas/api/leads"
import { cn } from "@/lib/utils"

/** Board columns: the open statuses, then won and lost (spam is a folder). */
export const BOARD_COLUMNS = [
  "new",
  "contacted",
  "qualified",
  "won",
  "lost",
] as const
type BoardColumn = (typeof BOARD_COLUMNS)[number]

const isColumn = (value: unknown): value is BoardColumn =>
  (BOARD_COLUMNS as readonly unknown[]).includes(value)

const MOVE_FAILED = "Couldn't move that enquiry"

/** A move on its way (`settled` = saved; dropped when fresh data arrives). */
type PendingMove = { status: LeadStatus; settled: boolean }

/**
 * The inbox as a kanban board (MK parity D3.3). A card opens its drawer by
 * click or Enter. With lead:update a card moves to another column by
 * pointer drag, by keyboard (Space picks up, Left/Right arrows move between
 * columns, Space or Enter drops, Escape cancels; announced to screen
 * readers) or with its Move menu (WCAG 2.2 SC 2.5.7 single-pointer
 * alternative). Moves are optimistic and snap back on failure.
 */
export function LeadsBoard({
  leads,
  canUpdate,
  onOpen,
  onMove,
}: {
  leads: LeadListItem[]
  canUpdate: boolean
  onOpen(id: string): void
  onMove(id: string, status: LeadStatus): Promise<void>
}): JSX.Element {
  const dndId = useId()
  const [now] = useState(Date.now)
  const [moves, setMoves] = useState<Record<string, PendingMove>>({})
  const [activeId, setActiveId] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const boardRef = useRef<HTMLDivElement>(null)
  /** The column a keyboard drag is over (null: pointer drag or no drag). */
  const keyboardTarget = useRef<number | null>(null)
  /** The column last announced during this drag. */
  const announcedOver = useRef<UniqueIdentifier | null>(null)
  /** A pointer drag just ended: its trailing click must not open the card. */
  const justDragged = useRef(false)

  // A saved move gives way to the server's data once that has it, or once
  // fresh data arrives (adjusted during render, not in an effect).
  const [seenLeads, setSeenLeads] = useState(leads)
  const leadsChanged = seenLeads !== leads
  if (leadsChanged) setSeenLeads(leads)
  const stale = Object.entries(moves).filter(
    ([id, m]) =>
      m.settled &&
      (leadsChanged || leads.find((l) => l.id === id)?.status === m.status)
  )
  if (stale.length) {
    const next = { ...moves }
    for (const [id] of stale) delete next[id]
    setMoves(next)
  }

  const statusOf = (lead: LeadListItem): LeadStatus =>
    moves[lead.id]?.status ?? lead.status
  const leadOf = (id: UniqueIdentifier) => leads.find((l) => l.id === id)
  const nameOf = (id: UniqueIdentifier) => leadOf(id)?.name ?? "enquiry"
  const labelOf = (id: UniqueIdentifier) =>
    isColumn(id) ? LEAD_STATUS_LABELS[id] : String(id)

  /** Focus a card again after it moved columns (it was re-mounted). */
  function refocus(id: string) {
    requestAnimationFrame(() => {
      const active = document.activeElement
      if (active && active !== document.body && active.isConnected) return
      boardRef.current
        ?.querySelector<HTMLElement>(`[data-lead-card="${CSS.escape(id)}"]`)
        ?.focus()
    })
  }

  function move(id: string, to: BoardColumn) {
    const lead = leadOf(id)
    if (!canUpdate || !lead || statusOf(lead) === to) return
    const from = statusOf(lead)
    setMoves((m) => ({ ...m, [id]: { status: to, settled: false } }))
    refocus(id)
    onMove(id, to).then(
      () =>
        setMoves((m) =>
          m[id]?.status === to
            ? { ...m, [id]: { status: to, settled: true } }
            : m
        ),
      () => {
        setMoves((m) => {
          const next = { ...m }
          delete next[id]
          return next
        })
        toast.error(MOVE_FAILED)
        setMessage(
          `${MOVE_FAILED}. ${lead.name} is back in ${LEAD_STATUS_LABELS[from]}.`
        )
        refocus(id)
      }
    )
  }

  /**
   * Keyboard moves go column by column (not pixel by pixel): the target
   * column is remembered, and the overlay jumps to that column's centre.
   */
  const coordinateGetter: KeyboardCoordinateGetter = (
    event,
    { context, currentCoordinates }
  ) => {
    const step =
      event.code === KeyboardCode.Right
        ? 1
        : event.code === KeyboardCode.Left
          ? -1
          : 0
    if (!step || keyboardTarget.current === null) return undefined
    const to = keyboardTarget.current + step
    if (to < 0 || to >= BOARD_COLUMNS.length) return undefined
    keyboardTarget.current = to
    const rect = context.droppableRects.get(BOARD_COLUMNS[to])
    const width = context.collisionRect?.width ?? 0
    return rect && rect.width > 0
      ? { x: rect.left + (rect.width - width) / 2, y: currentCoordinates.y }
      : { x: currentCoordinates.x + step, y: currentCoordinates.y }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      // Enter opens the card, so only Space picks it up.
      keyboardCodes: {
        start: [KeyboardCode.Space],
        cancel: [KeyboardCode.Esc],
        end: [KeyboardCode.Space, KeyboardCode.Enter],
      },
      coordinateGetter,
    })
  )

  const collisionDetection: CollisionDetection = (args) => {
    if (keyboardTarget.current !== null)
      return [{ id: BOARD_COLUMNS[keyboardTarget.current] }]
    const hits = pointerWithin(args)
    return hits.length ? hits : rectIntersection(args)
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up enquiry from ${nameOf(active.id)}`,
    onDragOver: ({ over }) => {
      if (!over || over.id === announcedOver.current) return undefined
      announcedOver.current = over.id
      return `Moved to ${labelOf(over.id)}`
    },
    onDragEnd: ({ over }) =>
      over ? `Dropped in ${labelOf(over.id)}` : "Dropped",
    onDragCancel: ({ active }) => {
      const lead = leadOf(active.id)
      return lead
        ? `Move cancelled. ${lead.name} stays in ${LEAD_STATUS_LABELS[statusOf(lead)]}`
        : "Move cancelled"
    },
  }

  function onDragStart({ active, activatorEvent }: DragStartEvent) {
    const lead = leadOf(active.id)
    const column = lead ? statusOf(lead) : null
    announcedOver.current = column
    keyboardTarget.current =
      activatorEvent instanceof KeyboardEvent && isColumn(column)
        ? BOARD_COLUMNS.indexOf(column)
        : null
    setActiveId(String(active.id))
    setMessage("")
  }

  function endDrag() {
    keyboardTarget.current = null
    announcedOver.current = null
    setActiveId(null)
  }

  function onDragEnd({ active, over, activatorEvent }: DragEndEvent) {
    endDrag()
    if (!(activatorEvent instanceof KeyboardEvent)) {
      justDragged.current = true
      setTimeout(() => {
        justDragged.current = false
      })
    }
    if (over && isColumn(over.id)) move(String(active.id), over.id)
  }

  const activeLead = activeId ? leadOf(activeId) : undefined

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={collisionDetection}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Press Enter to open this enquiry. To move it, press Space to pick it up, the left and right arrow keys to choose a column, and Space to drop or Escape to cancel. Or use its Move button.",
        },
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={endDrag}
    >
      <div
        ref={boardRef}
        className="-mx-1 overflow-x-auto px-1 pb-2"
        data-slot="leads-board"
      >
        <div className="grid min-w-max auto-cols-[minmax(15rem,1fr)] grid-flow-col gap-3 md:min-w-0">
          {BOARD_COLUMNS.map((status) => (
            <Column
              key={status}
              status={status}
              leads={leads.filter((lead) => statusOf(lead) === status)}
              canUpdate={canUpdate}
              dragging={activeId !== null}
              pendingIds={moves}
              now={now}
              onOpen={(id) => {
                if (!justDragged.current) onOpen(id)
              }}
              onMoveTo={(id, to) => {
                const lead = leadOf(id)
                if (lead)
                  setMessage(`Moved ${lead.name} to ${LEAD_STATUS_LABELS[to]}`)
                move(id, to)
              }}
            />
          ))}
        </div>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {message}
      </p>
      <DragOverlay>
        {activeLead ? (
          <div className="rounded-xl bg-card p-3 shadow-lg ring-2 ring-primary">
            <CardFacts lead={activeLead} now={now} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function Column({
  status,
  leads,
  canUpdate,
  dragging,
  pendingIds,
  now,
  onOpen,
  onMoveTo,
}: {
  status: BoardColumn
  leads: LeadListItem[]
  canUpdate: boolean
  dragging: boolean
  pendingIds: Record<string, PendingMove>
  now: number
  onOpen(id: string): void
  onMoveTo(id: string, to: BoardColumn): void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const label = LEAD_STATUS_LABELS[status]
  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={cn(
        "flex min-h-40 flex-col gap-3 rounded-2xl bg-muted/50 p-3 transition-shadow dark:bg-muted/30",
        isOver && "ring-2 ring-primary"
      )}
    >
      <h3 className="flex items-center justify-between gap-2 px-1 text-sm font-semibold">
        <span>{label}</span>{" "}
        <span className="rounded-full bg-background px-2 text-xs text-muted-foreground tabular-nums">
          {leads.length}
        </span>
      </h3>
      {leads.length ? (
        <ul className="flex flex-col gap-2">
          {leads.map((lead) => (
            <Card
              key={lead.id}
              lead={lead}
              column={status}
              canUpdate={canUpdate}
              dragging={dragging}
              pending={pendingIds[lead.id]?.settled === false}
              now={now}
              onOpen={onOpen}
              onMoveTo={onMoveTo}
            />
          ))}
        </ul>
      ) : (
        <p className="px-1 text-sm text-muted-foreground">No enquiries</p>
      )}
    </section>
  )
}

function CardFacts({ lead, now }: { lead: LeadListItem; now: number }) {
  const details = [lead.company, lead.service].filter(Boolean)
  return (
    <span className="flex min-w-0 items-start gap-2">
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm font-semibold">{lead.name}</span>
        {details.length ? (
          <span className="truncate text-xs text-muted-foreground">
            {details.join(" · ")}
          </span>
        ) : null}
        <span className="text-xs text-muted-foreground">
          <RelativeTime iso={lead.createdAt} now={now} />
        </span>
      </span>
      {lead.assignee ? (
        <span
          title={lead.assignee.name}
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background text-xs font-medium text-muted-foreground ring-1 ring-border"
        >
          <span aria-hidden>{initials(lead.assignee.name)}</span>
          <span className="sr-only">Assigned to {lead.assignee.name}</span>
        </span>
      ) : null}
    </span>
  )
}

function Card({
  lead,
  column,
  canUpdate,
  dragging,
  pending,
  now,
  onOpen,
  onMoveTo,
}: {
  lead: LeadListItem
  column: BoardColumn
  canUpdate: boolean
  dragging: boolean
  pending: boolean
  now: number
  onOpen(id: string): void
  onMoveTo(id: string, to: BoardColumn): void
}) {
  const movable = canUpdate && !pending
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    disabled: !movable,
  })

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    // Space/Enter during a drag belong to the drag (picked up or dropped).
    if (dragging) return
    if (movable) listeners?.onKeyDown?.(event)
    if (event.defaultPrevented) return
    if (event.key === "Enter" || (!canUpdate && event.key === " ")) {
      event.preventDefault()
      onOpen(lead.id)
    } else if (event.key === " ") {
      // A card whose move is still saving: no page scroll, no pick-up.
      event.preventDefault()
    }
  }

  return (
    <li className="relative">
      <div
        ref={setNodeRef}
        {...(canUpdate ? attributes : {})}
        {...(movable ? listeners : {})}
        role="button"
        tabIndex={0}
        aria-disabled={undefined}
        aria-busy={pending || undefined}
        data-lead-card={lead.id}
        onClick={() => onOpen(lead.id)}
        onKeyDown={onKeyDown}
        className={cn(
          "block cursor-pointer rounded-xl bg-card p-3 text-left shadow-xs ring-1 ring-foreground/5 outline-none hover:ring-foreground/15 focus-visible:ring-3 focus-visible:ring-ring/50",
          canUpdate && "pr-12 pointer-coarse:pr-14",
          isDragging && "opacity-40",
          pending && "opacity-70"
        )}
      >
        <CardFacts lead={lead} now={now} />
      </div>
      {canUpdate ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={pending}
                aria-label={`Move ${lead.name} to another column`}
                className="absolute top-2 right-2 pointer-coarse:size-11"
              />
            }
          >
            <MoveRight aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              {BOARD_COLUMNS.filter((s) => s !== column).map((status) => (
                <DropdownMenuItem
                  key={status}
                  className="pointer-coarse:min-h-11"
                  onClick={() => onMoveTo(lead.id, status)}
                >
                  {LEAD_STATUS_LABELS[status]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </li>
  )
}
