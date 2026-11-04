"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Download, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { FilterSelect } from "@/components/admin/filter-field"
import { FormCard } from "@/components/admin/form/form-ui"
import { RelativeTime } from "@/components/admin/kit/relative-time"
import { StatusPill } from "@/components/admin/kit/status-pill"
import { PageHeader } from "@/components/admin/page-header"
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
import { api, errorMessage, unwrap } from "@/lib/api-client"
import {
  APPLICATION_STATUS_LABELS,
  type ApplicationDto,
  type ApplicationStatus,
} from "@/lib/schemas/api/applications"

import {
  APPLICATION_STATUS_OPTIONS,
  APPLICATION_STATUS_TONE,
  applicationFileHref,
} from "./application-status"

const PSA = {
  valid: "Yes – valid licence",
  applied: "Applied – awaiting decision",
  no: "No",
}
const yesNo = (v: boolean) => (v ? "Yes" : "No")
const list = (values: string[]) => (values.length ? values.join(", ") : "—")
const text = (value: string) => value || "—"
const size = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,14rem)_1fr]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="text-sm font-medium break-words whitespace-pre-wrap">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** One application (Careers › Applications): answers by form section, files, status, note. */
export function ApplicationDetail({ id }: { id: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const canUpdate = usePermission({ application: ["update"] })
  const canDelete = usePermission({ application: ["delete"] })
  const queryKey = ["applications", id] as const
  const [deleted, setDeleted] = useState(false)
  const record = useQuery({
    queryKey,
    queryFn: () => unwrap(api.applications[":id"].$get({ param: { id } })),
    enabled: !deleted,
  })
  const [note, setNote] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const update = useMutation({
    mutationFn: (json: { status?: ApplicationStatus; note?: string }) =>
      unwrap(api.applications[":id"].$patch({ param: { id }, json })),
    onSuccess: async (dto, input) => {
      queryClient.setQueryData(queryKey, dto)
      if (input.note !== undefined) setNote(null)
      toast.success(input.status ? "Status changed" : "Note saved")
      await queryClient.invalidateQueries({
        queryKey: ["applications"],
        predicate: (q) => q.queryKey[1] !== id,
      })
    },
    onError: (err) =>
      toast.error("Not saved", { description: errorMessage(err) }),
  })

  const remove = useMutation({
    mutationFn: () =>
      unwrap(api.applications[":id"].$delete({ param: { id } })),
    onSuccess: async () => {
      setDeleted(true)
      queryClient.removeQueries({ queryKey })
      await queryClient.invalidateQueries({ queryKey: ["applications"] })
      toast.success("Application deleted")
      router.push("/admin/careers/applications")
    },
    onError: (err) => {
      setConfirming(false)
      toast.error("Not deleted", { description: errorMessage(err) })
    },
  })

  if (deleted)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Application deleted. Returning to all applications…
      </p>
    )
  if (record.isError)
    return (
      <p role="alert" className="text-sm text-destructive">
        {errorMessage(record.error)}
      </p>
    )
  const app: ApplicationDto | undefined = record.data
  if (!app)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading…
      </p>
    )
  const a = app.answers
  const licensed = a.psa === "valid"
  const files: {
    kind: "cv" | "psa-card"
    label: string
    file: ApplicationDto["cv"] | null
  }[] = [
    { kind: "cv", label: "CV", file: app.cv },
    { kind: "psa-card", label: "PSA card", file: app.psaCard },
  ]

  return (
    <>
      <PageHeader
        title={app.name}
        description={
          <>
            Applied for{" "}
            {app.job.id ? (
              <Link
                href={`/admin/careers/jobs/${app.job.id}`}
                className="font-semibold underline-offset-4 hover:underline"
              >
                {app.job.title}
              </Link>
            ) : (
              app.job.title
            )}{" "}
            · <RelativeTime iso={app.createdAt} />
          </>
        }
        breadcrumbs={[
          { label: "Applications", href: "/admin/careers/applications" },
        ]}
        actions={
          canDelete ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirming(true)}
            >
              <Trash2 aria-hidden />
              Delete
            </Button>
          ) : null
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <FormCard id="personal" title="Personal Details">
            <Rows
              rows={[
                ["Name", `${a.firstName} ${a.surname}`],
                ["Email", a.email],
                ["Mobile", a.phone],
                ["Address", text(a.address)],
                ["Town / County", a.town],
                ["Eircode", text(a.eircode)],
              ]}
            />
          </FormCard>
          <FormCard id="right-to-work" title="Right to Work in Ireland">
            <Rows
              rows={[
                ["Permission", a.rightToWork],
                ["Permission expiry", text(a.permissionExpiry)],
              ]}
            />
          </FormCard>
          <FormCard id="psa" title="PSA Licence">
            <Rows
              rows={[
                ["PSA licence", PSA[a.psa]],
                ...(licensed
                  ? ([
                      ["Licence number", a.psaNumber],
                      ["Category", a.psaCategory],
                      ["Expiry", a.psaExpiry],
                    ] as [string, string][])
                  : []),
                ["Qualifications", list(a.qualifications)],
              ]}
            />
          </FormCard>
          <FormCard id="history" title="5-Year History & Screening">
            <ol className="flex flex-col gap-4">
              {a.history.map((p, i) => (
                <li key={i} className="rounded-xl border p-4">
                  <p className="mb-2 text-sm font-semibold">Period {i + 1}</p>
                  <Rows
                    rows={[
                      ["Employer / activity", p.employer],
                      ["Role", text(p.role)],
                      ["From – to", `${p.from} – ${p.to || "Present"}`],
                      ["Reason for leaving", text(p.reason)],
                    ]}
                  />
                </li>
              ))}
            </ol>
            <Rows
              rows={[
                ["Garda vetting", yesNo(a.gardaVetting)],
                ["Lived abroad 6+ months", yesNo(a.livedAbroad)],
              ]}
            />
          </FormCard>
          <FormCard id="experience" title="Experience & Availability">
            <Rows
              rows={[
                ["Experience in Ireland", a.experience],
                ["Earliest start", a.startDate],
                ["Shifts", list(a.shifts)],
                ["Licence & own transport", yesNo(a.transport)],
              ]}
            />
          </FormCard>
          <FormCard id="cv" title="CV & Cover Note">
            <Rows
              rows={[
                ["Cover note", text(a.coverNote)],
                ["Heard about the job", text(a.heardFrom)],
              ]}
            />
          </FormCard>
          <FormCard id="declaration" title="Declaration & Consent">
            <Rows
              rows={[
                ["Information true and complete", yesNo(a.consents[0])],
                ["Data processing", yesNo(a.consents[1])],
                ["Keep on file for future roles", yesNo(a.consents[2])],
              ]}
            />
          </FormCard>
        </div>
        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          <FormCard id="status" title="Status">
            <span data-testid="application-status" className="self-start">
              <StatusPill tone={APPLICATION_STATUS_TONE[app.status]}>
                {APPLICATION_STATUS_LABELS[app.status]}
              </StatusPill>
            </span>
            {canUpdate ? (
              <FilterSelect
                id="application-status"
                label="Status"
                value={app.status}
                options={APPLICATION_STATUS_OPTIONS}
                onChange={(value) =>
                  value !== app.status &&
                  update.mutate({ status: value as ApplicationStatus })
                }
              />
            ) : null}
          </FormCard>
          <FormCard id="files" title="Files">
            <ul className="flex flex-col gap-2">
              {files.map(({ kind, label, file }) =>
                file ? (
                  <li key={kind}>
                    <a
                      href={applicationFileHref(app.id, kind)}
                      className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium hover:bg-muted"
                    >
                      <Download aria-hidden className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">
                        {label}: {file.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {size(file.size)}
                      </span>
                    </a>
                  </li>
                ) : (
                  <li key={kind} className="text-sm text-muted-foreground">
                    {label}: not provided
                  </li>
                )
              )}
            </ul>
          </FormCard>
          <FormCard id="note" title="Internal note">
            <label htmlFor="application-note" className="sr-only">
              Internal note
            </label>
            <Textarea
              id="application-note"
              value={note ?? app.note}
              disabled={!canUpdate}
              onChange={(e) => setNote(e.target.value)}
              rows={5}
            />
            {canUpdate ? (
              <Button
                type="button"
                variant="outline"
                className="self-start"
                disabled={
                  note === null || note === app.note || update.isPending
                }
                onClick={() => update.mutate({ note: note ?? "" })}
              >
                Save note
              </Button>
            ) : null}
          </FormCard>
        </aside>
      </div>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this application?</AlertDialogTitle>
            <AlertDialogDescription>
              {app.name}’s answers, CV and PSA card are deleted for good.
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
              Delete application
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
