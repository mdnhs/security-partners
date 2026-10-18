"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Download, Inbox, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"
import { toast } from "sonner"

import {
  ADMIN_CONTROL,
  ADMIN_TEXTAREA,
  FormCard,
} from "@/components/admin/form/form-ui"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { CardSkeleton } from "@/components/admin/kit/skeletons"
import {
  FORM_ACTION,
  LINK_FORM,
  LINK_SECONDARY,
  PageHeader,
  PRIMARY_ACTION,
} from "@/components/admin/page-header"
import { FieldShell } from "@/components/admin/schema-form/widgets/field-shell"
import {
  SectionTabs,
  SectionTabsPanel,
} from "@/components/admin/section-tabs/section-tabs"
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
import { Textarea } from "@/components/ui/textarea"
import { usePermission } from "@/hooks/use-permission"
import { leadExportHref } from "@/lib/admin/leads"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
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

import { LeadStatusBadge } from "./lead-status-badge"

const SELECT = cn(
  ADMIN_CONTROL,
  "w-full border border-input outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:h-11"
)

const leadKey = (id: string) => ["leads", "detail", id] as const

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
 * One lead (spec §8.1): the enquiry and its handling (status, assignee) as
 * section tabs with notes and the activity history; subject-access export
 * and deletion (GDPR) in the header. Status and assignee save on change.
 * Every change refreshes the server shell so the sidebar's count follows.
 */
export function LeadDetail({ id }: { id: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const canUpdate = usePermission({ lead: ["update"] })
  const canDelete = usePermission({ lead: ["delete"] })
  const canExport = usePermission({ lead: ["export"] })
  const [note, setNote] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const statusId = useId()
  const assigneeId = useId()
  const noteId = useId()
  const key = leadKey(id)

  const lead = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await unwrap(api.leads[":id"].$get({ param: { id } }))) as LeadDto,
  })
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

  const update = useMutation({
    mutationFn: async (json: UpdateLeadInput) =>
      (await unwrap(
        api.leads[":id"].$patch({ param: { id }, json })
      )) as LeadDto,
    onSuccess: (dto) => {
      applied(dto)
      toast.success("Lead updated")
    },
    onError: (error) =>
      toast.error("Not saved", { description: errorMessage(error) }),
  })
  const addNote = useMutation({
    mutationFn: async (body: string) =>
      (await unwrap(
        api.leads[":id"].events.$post({ param: { id }, json: { body } })
      )) as LeadDto,
    onSuccess: (dto) => {
      applied(dto)
      setNote("")
      toast.success("Note added")
    },
    onError: (error) =>
      toast.error("Note not added", { description: errorMessage(error) }),
  })
  const remove = useMutation({
    mutationFn: async () => unwrap(api.leads[":id"].$delete({ param: { id } })),
    onSuccess: () => {
      setConfirmDelete(false)
      queryClient.removeQueries({ queryKey: key })
      void queryClient.invalidateQueries({ queryKey: ["leads"] })
      toast.success("Lead deleted")
      router.push("/admin/leads")
      router.refresh()
    },
    onError: (error) => {
      setConfirmDelete(false)
      toast.error("Not deleted", { description: errorMessage(error) })
    },
  })

  if (lead.isPending)
    return (
      <div role="status" aria-busy="true">
        <span className="sr-only">Loading lead…</span>
        <CardSkeleton className="h-24" />
      </div>
    )
  if (lead.isError) {
    const missing = lead.error instanceof ApiError && lead.error.status === 404
    return (
      <EmptyState
        role="alert"
        icon={Inbox}
        title={missing ? "This lead does not exist" : "The lead didn't load"}
        description={
          missing
            ? "It may have been deleted, or the link is wrong."
            : errorMessage(lead.error)
        }
        action={
          <Link href="/admin/leads" className={LINK_FORM}>
            All leads
          </Link>
        }
      />
    )
  }

  const data = lead.data
  const notes = data.events.filter((e) => e.type === "note")
  const knownAssignee =
    !data.assignee ||
    (assignees.data ?? []).some((u) => u.id === data.assignee?.id)

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Link
            href="/admin/leads"
            className="inline-flex w-fit items-center gap-1 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ArrowLeft aria-hidden className="size-4" />
            All leads
          </Link>
        }
        title={data.name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <LeadStatusBadge status={data.status} />
            <span>
              Received{" "}
              <time dateTime={data.createdAt}>
                {formatDateTime(data.createdAt)}
              </time>
            </span>
          </span>
        }
        actions={
          canExport || canDelete ? (
            <>
              {canExport ? (
                <a
                  href={leadExportHref({ status: "all", email: data.email })}
                  download
                  className={LINK_SECONDARY}
                >
                  <Download aria-hidden />
                  Export this person&apos;s data
                </a>
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
            </>
          ) : null
        }
      />
      <SectionTabs
        ariaLabel="Lead sections"
        heading="Lead"
        items={[
          { id: "details", label: "Details" },
          {
            id: "notes",
            label: "Notes",
            badge: notes.length ? (
              <span className="rounded-full bg-muted px-1.5 text-xs font-semibold text-muted-foreground tabular-nums">
                {notes.length}
              </span>
            ) : undefined,
          },
          { id: "activity", label: "Activity" },
        ]}
      >
        <SectionTabsPanel id="details">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <FormCard id="lead-enquiry" title="Enquiry">
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
              <div className="flex flex-col gap-1">
                <h3 className="text-xs font-medium text-muted-foreground">
                  Message
                </h3>
                <p className="rounded-lg border bg-muted/40 p-3 text-sm break-words whitespace-pre-wrap">
                  {data.message}
                </p>
              </div>
            </FormCard>
            <FormCard
              id="lead-handling"
              title="Handling"
              description={
                canUpdate
                  ? "Changes save straight away."
                  : "You can read this lead but not change it."
              }
              className="self-start"
            >
              <FieldShell id={statusId} label="Lead status">
                <select
                  id={statusId}
                  className={SELECT}
                  value={data.status}
                  disabled={!canUpdate || update.isPending}
                  onChange={(event) =>
                    update.mutate({ status: event.target.value as LeadStatus })
                  }
                >
                  {LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {LEAD_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </FieldShell>
              <FieldShell id={assigneeId} label="Assigned to">
                <select
                  id={assigneeId}
                  className={SELECT}
                  value={data.assignee?.id ?? ""}
                  disabled={!canUpdate || update.isPending}
                  onChange={(event) =>
                    update.mutate({ assigneeId: event.target.value || null })
                  }
                >
                  <option value="">Unassigned</option>
                  {data.assignee && !knownAssignee ? (
                    <option value={data.assignee.id}>
                      {data.assignee.name}
                    </option>
                  ) : null}
                  {(assignees.data ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </FieldShell>
            </FormCard>
          </div>
        </SectionTabsPanel>
        <SectionTabsPanel id="notes">
          <FormCard
            id="lead-notes"
            title="Notes"
            description="For the team only; never sent to the person."
            className="max-w-3xl"
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
                className="flex flex-col gap-3 border-t pt-5"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (note.trim()) addNote.mutate(note.trim())
                }}
              >
                <FieldShell id={noteId} label="Add a note">
                  <Textarea
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
          </FormCard>
        </SectionTabsPanel>
        <SectionTabsPanel id="activity">
          <FormCard
            id="lead-activity"
            title="Activity"
            description="Everything that happened to this lead, oldest first."
            className="max-w-3xl"
          >
            <ol className="flex flex-col gap-4">
              {data.events.map((event) => (
                <EventLine key={event.id} event={event} />
              ))}
            </ol>
          </FormCard>
        </SectionTabsPanel>
      </SectionTabs>
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
