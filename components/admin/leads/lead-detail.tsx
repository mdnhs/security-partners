"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState } from "react"
import { toast } from "sonner"

import { useAssistantScreen } from "@/components/admin/ai/assistant-context"
import { leadAssistantScreen } from "@/components/admin/ai/screens"
import { UnsavedGuard } from "@/components/admin/editor/unsaved-guard"
import { ADMIN_TEXTAREA } from "@/components/admin/form/form-ui"
import { CardSkeleton } from "@/components/admin/kit/skeletons"
import { OptionSelect } from "@/components/admin/option-select"
import { FORM_ACTION, PRIMARY_ACTION } from "@/components/admin/page-header"
import { FieldShell } from "@/components/admin/schema-form/widgets/field-shell"
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
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { usePermission } from "@/hooks/use-permission"
import { leadExportHref } from "@/lib/admin/leads"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import {
  type Attribution,
  UTM_KEYS,
  type UtmKey,
} from "@/lib/leads/attribution"
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  type LeadAssignee,
  type LeadDto,
  type LeadEventItem,
  type LeadStatus,
  type UpdateLeadInput,
} from "@/lib/schemas/api/leads"
import { cn } from "@/lib/utils"

import { CsvDownloadButton } from "./csv-download-button"
import { LeadStatusBadge } from "./lead-status-badge"
import { leadGuardScope } from "./use-leads-params"

// The Handling card sets aria-busy while a change saves.
const SELECT = "w-full disabled:opacity-60 in-aria-busy:cursor-progress"

export const leadKey = (id: string) => ["leads", "detail", id] as const

/** One status/assignee change; `seq` orders it among this drawer's changes. */
type LeadChange = { json: UpdateLeadInput; seq: number }

function Fact({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  )
}

/** Shown for an empty fact: a dash, with words for screen readers. */
function None() {
  return (
    <span className="text-muted-foreground">
      <span aria-hidden>—</span>
      <span className="sr-only">Not given</span>
    </span>
  )
}

const FACT_LINK =
  "rounded-sm underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"

const UTM_LABELS: Record<UtmKey, string> = {
  utm_source: "UTM source",
  utm_medium: "UTM medium",
  utm_campaign: "UTM campaign",
  utm_term: "UTM term",
  utm_content: "UTM content",
}

/** A titled drawer section: a region named by its heading. */
function Section({
  id,
  title,
  count,
  description,
  children,
  className,
  ...rest
}: {
  id: string
  title: string
  /** Shown after the heading ("Notes · 2 notes"); the region keeps its name. */
  count?: string
  description?: React.ReactNode
  children: React.ReactNode
} & Omit<React.ComponentProps<"section">, "id" | "title">) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn("flex min-w-0 flex-col gap-3", className)}
      {...rest}
    >
      <header className="flex flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <h3 id={`${id}-title`} className="text-sm font-semibold">
            {title}
          </h3>
          {count ? (
            <span className="rounded-full bg-muted px-2 text-xs text-muted-foreground tabular-nums">
              {count}
            </span>
          ) : null}
        </span>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  )
}

/**
 * Where the visitor first came from this visit (D3.1). Every value is
 * visitor-supplied: shown as plain text, never as a link.
 */
function LeadSource({
  id,
  attribution,
}: {
  id: string
  attribution: Attribution | null
}) {
  return (
    <Section
      id={id}
      title="Source"
      description="First page of the visit that sent this enquiry."
    >
      {attribution ? (
        <dl className="grid gap-4 sm:grid-cols-2">
          <Fact label="Referrer">
            {attribution.referrer ? (
              <span className="break-all">{attribution.referrer}</span>
            ) : (
              <None />
            )}
          </Fact>
          <Fact label="Landing page">
            <code className="font-mono text-xs break-all">
              {attribution.landingPath}
            </code>
          </Fact>
          {UTM_KEYS.map((key) => (
            <Fact key={key} label={UTM_LABELS[key]}>
              {attribution.utm[key] ?? <None />}
            </Fact>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          No source was recorded for this enquiry.
        </p>
      )}
    </Section>
  )
}

/** One note or history entry: who (or "Website") · when, then the text. */
function EventLine({ event }: { event: LeadEventItem }) {
  return (
    <li className="flex flex-col gap-1 border-l-2 border-border pl-3">
      <span className="text-xs text-muted-foreground">
        {event.actor?.name ?? "Website"} ·{" "}
        <time dateTime={event.createdAt}>
          {formatDateTime(event.createdAt)}
        </time>
      </span>
      {event.body ? (
        <span className="text-sm break-words whitespace-pre-wrap">
          {event.body}
        </span>
      ) : null}
    </li>
  )
}

/**
 * One lead (spec §8.1) as the body of the leads drawer (D3.2): contact,
 * message, source, status & assignee (saved on change), notes and the
 * activity history; subject-access export and deletion (GDPR) at the end.
 * Renders inside a `SheetContent` (its title names the dialog). Every change
 * refreshes the server shell so the sidebar's count follows.
 *
 * `onMissing`: the lead does not exist (deleted meanwhile, or a wrong link);
 * the message stays shown. `onDeleted`: this person deleted it here.
 */
export function LeadDetailBody({
  id,
  onMissing,
  onDeleted,
  discardNote = 0,
}: {
  id: string
  onMissing?: () => void
  onDeleted?: () => void
  /** Changes when the drawer closes: a typed note is discarded then. */
  discardNote?: number
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const canUpdate = usePermission({ lead: ["update"] })
  const canDelete = usePermission({ lead: ["delete"] })
  const canExport = usePermission({ lead: ["export"] })
  const [note, setNote] = useState("")
  const [seenDiscard, setSeenDiscard] = useState(discardNote)
  if (seenDiscard !== discardNote) {
    setSeenDiscard(discardNote)
    setNote("")
  }
  const [confirmDelete, setConfirmDelete] = useState(false)
  const uid = useId()
  const statusId = `${uid}-status`
  const assigneeId = `${uid}-assignee`
  const noteId = `${uid}-note`
  const noteRef = useRef<HTMLTextAreaElement>(null)
  /** The newest status/assignee change; older responses are not applied. */
  const latestChange = useRef(0)
  const key = leadKey(id)

  const lead = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await unwrap(api.leads[":id"].$get({ param: { id } }))) as LeadDto,
  })
  const missing =
    lead.isError && lead.error instanceof ApiError && lead.error.status === 404
  // Tell the drawer once, so it clears ?lead= while the message stays.
  const reportedMissing = useRef(false)
  useEffect(() => {
    if (!missing || reportedMissing.current) return
    reportedMissing.current = true
    onMissing?.()
  }, [missing, onMissing])
  // "Summarise this lead" (spec §8.3): the assistant sees the open lead once
  // it has loaded. Hooks run before every early return below.
  useAssistantScreen(lead.data ? leadAssistantScreen(lead.data) : null)
  const assignees = useQuery({
    queryKey: ["leads", "assignees"],
    queryFn: async () =>
      (await unwrap(api.leads.assignees.$get())).items as LeadAssignee[],
    enabled: canUpdate,
  })

  /** A fresh lead from the API: cache it, refetch lists, refresh the badge. */
  const applied = (dto: LeadDto) => {
    queryClient.setQueryData(key, dto)
    void queryClient.invalidateQueries({
      queryKey: ["leads"],
      predicate: (q) => q.queryKey[1] !== "detail",
    })
    router.refresh()
  }

  // Saves run one at a time (scope) in the order chosen; the selects stay
  // enabled (disabling one drops its focus, and arrow keys fire a change
  // per press), showing each choice at once.
  const update = useMutation({
    scope: { id: `lead-${id}` },
    mutationFn: async ({ json }: LeadChange) =>
      (await unwrap(
        api.leads[":id"].$patch({ param: { id }, json })
      )) as LeadDto,
    onSuccess: (dto, change) => {
      // A newer choice is still on its way: keep showing that one.
      if (change.seq === latestChange.current) applied(dto)
      // The select already shows the change: only failures toast (M8).
    },
    onError: (error, change) => {
      toast.error("Not saved", { description: errorMessage(error) })
      if (change.seq !== latestChange.current) return
      // Back to what the server has (earlier changes may have saved).
      void queryClient.invalidateQueries({ queryKey: key })
      router.refresh()
    },
  })
  const change = (json: UpdateLeadInput) => {
    const seq = ++latestChange.current
    void queryClient.cancelQueries({ queryKey: key })
    queryClient.setQueryData<LeadDto>(key, (prev) => {
      if (!prev) return prev
      const next = { ...prev }
      if (json.status) next.status = json.status
      if (json.assigneeId !== undefined) {
        const person = (assignees.data ?? []).find(
          (u) => u.id === json.assigneeId
        )
        next.assignee = person
          ? { id: person.id, name: person.name }
          : prev.assignee?.id === json.assigneeId
            ? prev.assignee
            : null
      }
      return next
    })
    update.mutate({ json, seq })
  }
  const addNote = useMutation({
    mutationFn: async (body: string) =>
      (await unwrap(
        api.leads[":id"].events.$post({ param: { id }, json: { body } })
      )) as LeadDto,
    onSuccess: (dto) => {
      applied(dto)
      setNote("")
      toast.success("Note added")
      // The button was disabled while saving: give focus back to the box.
      noteRef.current?.focus()
    },
    onError: (error) => {
      toast.error("Note not added", { description: errorMessage(error) })
      noteRef.current?.focus()
    },
  })
  const remove = useMutation({
    mutationFn: async () => unwrap(api.leads[":id"].$delete({ param: { id } })),
    onSuccess: () => {
      setConfirmDelete(false)
      queryClient.removeQueries({ queryKey: key })
      void queryClient.invalidateQueries({ queryKey: ["leads"] })
      toast.success("Lead deleted")
      onDeleted?.()
      router.refresh()
    },
    onError: (error) => {
      setConfirmDelete(false)
      toast.error("Not deleted", { description: errorMessage(error) })
    },
  })

  if (lead.isPending)
    return (
      <>
        <SheetHeader className="border-b pr-12">
          <SheetTitle className="text-lg font-semibold">Enquiry</SheetTitle>
          <SheetDescription>Loading…</SheetDescription>
        </SheetHeader>
        <div role="status" className="p-4">
          <span className="sr-only">Loading enquiry…</span>
          <CardSkeleton className="h-24" />
        </div>
      </>
    )
  if (lead.isError)
    return (
      <>
        <SheetHeader className="border-b pr-12">
          <SheetTitle className="text-lg font-semibold">Enquiry</SheetTitle>
        </SheetHeader>
        <div role="alert" className="flex flex-col gap-1 p-4">
          <p className="font-semibold">
            {missing
              ? "This enquiry no longer exists"
              : "The enquiry didn't load"}
          </p>
          <p className="text-sm text-muted-foreground">
            {missing
              ? "It may have been deleted, or the link is wrong."
              : errorMessage(lead.error)}
          </p>
          {missing ? null : (
            <Button
              type="button"
              className={cn(FORM_ACTION, "mt-2 self-start")}
              onClick={() => void lead.refetch()}
            >
              Try again
            </Button>
          )}
        </div>
      </>
    )

  const data = lead.data
  const notes = data.events.filter((e) => e.type === "note")
  const knownAssignee =
    !data.assignee ||
    (assignees.data ?? []).some((u) => u.id === data.assignee?.id)

  return (
    <>
      <SheetHeader className="border-b pr-12">
        <SheetTitle className="text-lg font-semibold break-words">
          {data.name}
        </SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <LeadStatusBadge status={data.status} />
          <span>
            Received{" "}
            <time dateTime={data.createdAt}>
              {formatDateTime(data.createdAt)}
            </time>
          </span>
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-6 p-4">
        <Section id={`${uid}-contact`} title="Contact">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Fact label="Email">
              <a href={`mailto:${data.email}`} className={FACT_LINK}>
                {data.email}
              </a>
            </Fact>
            <Fact label="Phone">
              {data.phone ? (
                <a
                  href={`tel:${data.phone.replace(/[^\d+]/g, "")}`}
                  className={FACT_LINK}
                >
                  {data.phone}
                </a>
              ) : (
                <None />
              )}
            </Fact>
            <Fact label="Company">{data.company ?? <None />}</Fact>
            <Fact label="Service">{data.service ?? <None />}</Fact>
            <Fact label="Sent from">
              {data.sourcePage ? (
                <code className="font-mono text-xs">{data.sourcePage}</code>
              ) : (
                <None />
              )}
            </Fact>
            <Fact label="Consent to be contacted">
              {data.consent ? "Yes" : "No"}
            </Fact>
          </dl>
        </Section>
        <Section id={`${uid}-message`} title="Message">
          <p className="rounded-lg border bg-muted/40 p-3 text-sm break-words whitespace-pre-wrap">
            {data.message}
          </p>
        </Section>
        <LeadSource id={`${uid}-source`} attribution={data.attribution} />
        <Section
          id={`${uid}-handling`}
          role="region"
          title="Status & assignee"
          description={
            canUpdate
              ? "Changes save straight away."
              : "You can read this lead but not change it."
          }
          aria-busy={update.isPending || undefined}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell id={statusId} label="Lead status">
              <OptionSelect
                id={statusId}
                className={SELECT}
                value={data.status}
                disabled={!canUpdate}
                onChange={(value) => change({ status: value as LeadStatus })}
                options={LEAD_STATUSES.map((s) => ({
                  value: s,
                  label: LEAD_STATUS_LABELS[s],
                }))}
              />
            </FieldShell>
            <FieldShell id={assigneeId} label="Assigned to">
              <OptionSelect
                id={assigneeId}
                className={SELECT}
                value={data.assignee?.id ?? ""}
                disabled={!canUpdate}
                onChange={(value) => change({ assigneeId: value || null })}
                options={[
                  { value: "", label: "Unassigned" },
                  ...(data.assignee && !knownAssignee
                    ? [{ value: data.assignee.id, label: data.assignee.name }]
                    : []),
                  ...(assignees.data ?? []).map((u) => ({
                    value: u.id,
                    label: u.name,
                  })),
                ]}
              />
            </FieldShell>
          </div>
        </Section>
        <Section
          id={`${uid}-notes`}
          title="Notes"
          count={
            notes.length
              ? `${notes.length} ${notes.length === 1 ? "note" : "notes"}`
              : undefined
          }
          description="For the team only; never sent to the person."
        >
          {notes.length ? (
            <ol className="flex flex-col gap-4">
              {notes.map((event) => (
                <EventLine key={event.id} event={event} />
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          )}
          {canUpdate ? (
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                if (note.trim()) addNote.mutate(note.trim())
              }}
            >
              {/* A note typed but not added is not dropped silently. */}
              <UnsavedGuard
                when={note.trim() !== ""}
                scope={leadGuardScope(id)}
              />
              <FieldShell id={noteId} label="Add a note">
                <Textarea
                  ref={noteRef}
                  id={noteId}
                  rows={3}
                  maxLength={5000}
                  className={ADMIN_TEXTAREA}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </FieldShell>
              <Button
                type="submit"
                className={cn(FORM_ACTION, "self-start")}
                disabled={addNote.isPending || !note.trim()}
              >
                Add note
              </Button>
            </form>
          ) : null}
        </Section>
        <Section
          id={`${uid}-activity`}
          title="Activity"
          description="Everything that happened to this lead, oldest first."
        >
          <ol className="flex flex-col gap-4">
            {data.events.map((event) => (
              <EventLine key={event.id} event={event} />
            ))}
          </ol>
        </Section>
        {canExport || canDelete ? (
          <div className="flex flex-wrap gap-2 border-t pt-4">
            {canExport ? (
              <CsvDownloadButton
                href={leadExportHref({ status: "all", email: data.email })}
              >
                Export this person&apos;s data
              </CsvDownloadButton>
            ) : null}
            {canDelete ? (
              <Button
                type="button"
                variant="destructive"
                className={PRIMARY_ACTION}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 aria-hidden />
                Delete
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Its notes and history are deleted too. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Delete lead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
