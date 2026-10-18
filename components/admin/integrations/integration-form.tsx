"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, CircleAlert } from "lucide-react"
import Link from "next/link"
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"

import { UnsavedGuard } from "@/components/admin/editor/unsaved-guard"
import { FormCard } from "@/components/admin/form/form-ui"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { RelativeTime } from "@/components/admin/kit/relative-time"
import { CardSkeleton } from "@/components/admin/kit/skeletons"
import { StatusPill } from "@/components/admin/kit/status-pill"
import { FORM_ACTION, PageHeader } from "@/components/admin/page-header"
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
import { usePermission } from "@/hooks/use-permission"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import type {
  IntegrationDto,
  IntegrationTestResult,
} from "@/lib/schemas/api/integrations"
import { INTEGRATIONS, type IntegrationKey } from "@/lib/schemas/integrations"
import { cn } from "@/lib/utils"

import { IntegrationField, TestResult } from "./integration-fields"
import { type FieldMeta, INTEGRATION_FORMS } from "./integration-meta"

type Values = Record<string, unknown>
type Errors = Record<string, string>

/** Toast after a 409 with the current record: the form now shows it. */
export const CONFLICT_MESSAGE =
  "Someone else changed these settings — the form now shows their version. Enter any new secret again."

/**
 * Buttons that keep focus while unavailable (WCAG 2.4.3): aria-disabled
 * instead of disabled, so a click on Save or Test never drops focus to
 * the page; the handlers check the same condition.
 */
const SOFT_DISABLED =
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:active:translate-y-0"

const fieldId = (key: IntegrationKey, name: string) =>
  `${key.replace(".", "-")}-${name}`

/**
 * Field errors of a 422 by form field ("allowedRoles.1" → allowedRoles);
 * anything that names no field of this form is returned as `rest`.
 */
function fieldErrorsOf(
  fields: readonly FieldMeta[],
  fieldErrors: Record<string, string[]>
): { byField: Errors; rest: string[] } {
  const byField: Errors = {}
  const rest: string[] = []
  for (const [path, messages] of Object.entries(fieldErrors)) {
    const name = path.split(".")[0]!
    if (fields.some((field) => field.name === name))
      byField[name] ??= messages[0]!
    else rest.push(...messages)
  }
  return { byField, rest }
}

/**
 * One integration's settings (spec §5.4): saves immediately (optimistic
 * version), secrets are write-only (an empty input keeps the saved one),
 * "Test connection" uses the saved settings, "Disconnect" deletes them.
 */
export function IntegrationForm({
  integrationKey: key,
  children,
}: {
  integrationKey: IntegrationKey
  /** Rendered under the form (Task 8: the R2 migration panel). */
  children?: ReactNode
}) {
  const queryClient = useQueryClient()
  const canEdit = usePermission({ integration: ["update"] })
  const canTest = usePermission({ integration: ["test"] })
  const meta = INTEGRATION_FORMS[key]
  const query = useQuery({
    queryKey: ["integrations", key],
    queryFn: () => unwrap(api.integrations[":key"].$get({ param: { key } })),
  })
  const dto = query.data as IntegrationDto | undefined

  const [loaded, setLoaded] = useState<string | null>(null)
  const [values, setValues] = useState<Values>({})
  const [secrets, setSecrets] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [focusField, setFocusField] = useState<{ name: string } | null>(null)
  // After a disconnect the button that had focus is gone: focus the status.
  const statusRef = useRef<HTMLDivElement>(null)
  const disconnected = useRef(false)
  // The last test's outcome: the server's fixed message only.
  const [outcome, setOutcome] = useState<{
    ok: boolean
    message: string
  } | null>(null)

  // A new server state (load, save, their version, disconnect) resets the form.
  const stamp = dto ? `${dto.version}:${dto.updatedAt ?? ""}` : null
  if (dto && stamp !== loaded) {
    setLoaded(stamp)
    setValues(dto.values)
    setSecrets({})
    setErrors({})
    setFormError(null)
    setOutcome(null)
  }

  // Typed secrets never outlive the screen (hidden or unmounted routes).
  useEffect(() => () => setSecrets({}), [])

  useEffect(() => {
    if (!focusField) return
    const field = meta.fields.find((f) => f.name === focusField.name)
    if (!field) return
    const id = fieldId(key, field.name)
    const target = field.kind === "roles" ? `${id}-${field.roles[0]}` : id
    document.getElementById(target)?.focus()
  }, [focusField, key, meta.fields])

  const typedSecrets = Object.fromEntries(
    Object.entries(secrets).filter(([, v]) => v.trim() !== "")
  )
  const dirty =
    !!dto &&
    (JSON.stringify(values) !== JSON.stringify(dto.values) ||
      Object.keys(typedSecrets).length > 0)

  const takeTheirs = (err: unknown, title: string): boolean => {
    if (!(err instanceof ApiError && err.isConflict && err.current))
      return false
    queryClient.setQueryData(["integrations", key], err.current)
    void queryClient.invalidateQueries({ queryKey: ["integrations", "list"] })
    toast.error(title, {
      id: "integration-conflict",
      description: CONFLICT_MESSAGE,
    })
    return true
  }

  const test = useMutation({
    mutationFn: () =>
      unwrap(
        api.integrations[":key"].test.$post({ param: { key } })
      ) as Promise<IntegrationTestResult>,
    onMutate: () => setOutcome(null),
    onSuccess: (result) =>
      setOutcome({ ok: result.ok === true, message: String(result.message) }),
    onError: (err) => {
      setOutcome({ ok: false, message: errorMessage(err) })
      if (!(err instanceof ApiError)) return
      // e.g. a secret that can no longer be read: shown under its field.
      const { byField } = fieldErrorsOf(meta.fields, err.fieldErrors)
      const first = firstErrored(meta.fields, byField)
      if (!first) return
      setErrors(byField)
      setFocusField({ name: first })
    },
  })

  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.integrations[":key"].$put({
          param: { key },
          json: {
            version: dto!.version,
            values: { ...values, ...typedSecrets },
          },
        })
      ) as Promise<IntegrationDto>,
    onSuccess: (next) => {
      queryClient.setQueryData(["integrations", key], next)
      void queryClient.invalidateQueries({ queryKey: ["integrations", "list"] })
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Saved")
    },
    onError: (err) => {
      if (takeTheirs(err, "Not saved")) return
      if (err instanceof ApiError && err.status === 422) {
        const { byField, rest } = fieldErrorsOf(meta.fields, err.fieldErrors)
        setErrors(byField)
        const first = firstErrored(meta.fields, byField)
        if (first) setFocusField({ name: first })
        if (rest.length > 0 || !first) setFormError(rest[0] ?? err.message)
        return
      }
      toast.error("Not saved", { description: errorMessage(err) })
    },
  })

  const disconnect = useMutation({
    mutationFn: () =>
      unwrap(
        api.integrations[":key"].$delete({
          param: { key },
          query: { version: String(dto!.version) },
        })
      ),
    onSuccess: async () => {
      // The dialog closes once the form shows "Not set up", then hands
      // focus to the status (finalFocus), as Disconnect itself is gone.
      await queryClient.invalidateQueries({ queryKey: ["integrations"] })
      disconnected.current = true
      setConfirmDisconnect(false)
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Disconnected")
    },
    onError: (err) => {
      setConfirmDisconnect(false)
      if (takeTheirs(err, "Not disconnected")) return
      toast.error("Not disconnected", { description: errorMessage(err) })
    },
  })

  const header = (
    <PageHeader
      stacked
      breadcrumbs={
        <Link
          href="/admin/settings/integrations"
          className="inline-flex min-h-6 w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:underline pointer-coarse:min-h-11"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Integrations
        </Link>
      }
      title={INTEGRATIONS[key].label}
      description={meta.intro}
      actions={
        dto ? (
          <div
            ref={statusRef}
            tabIndex={-1}
            data-slot="integration-status"
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg text-sm text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <StatusPill tone={dto.configured ? "success" : "neutral"}>
              {dto.configured ? "Connected" : "Not set up"}
            </StatusPill>
            {dto.updatedAt ? (
              <span>
                Changed{" "}
                <RelativeTime iso={dto.updatedAt} now={query.dataUpdatedAt} />
                {dto.updatedBy ? ` by ${dto.updatedBy.name}` : ""}
              </span>
            ) : null}
          </div>
        ) : null
      }
    />
  )

  if (query.isPending)
    return (
      <div aria-busy="true">
        {header}
        <p className="sr-only">Loading settings…</p>
        <CardSkeleton className="h-96" />
      </div>
    )
  if (query.isError || !dto)
    return (
      <>
        {header}
        <EmptyState
          role="alert"
          icon={CircleAlert}
          title="These settings could not be loaded"
          description={errorMessage(query.error)}
          action={
            <Button
              type="button"
              variant="outline"
              className={FORM_ACTION}
              onClick={() => query.refetch()}
            >
              Try again
            </Button>
          }
        />
      </>
    )

  const busy = save.isPending || disconnect.isPending
  const canSave = dirty && !busy
  const canRunTest = !dirty && !busy && !test.isPending
  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!canEdit || !canSave) return
    setErrors({})
    setFormError(null)
    save.mutate()
  }
  const set = (name: string, value: unknown) =>
    setValues((prev) => ({ ...prev, [name]: value }))
  const slug = dto.slug

  return (
    <div className="flex flex-col gap-6">
      <div className="-mb-6">{header}</div>
      <UnsavedGuard when={dirty} />

      <FormCard
        id={`integration-${slug}`}
        title="Settings"
        description={
          canEdit
            ? "Secrets are stored encrypted and never shown again. Leave a secret empty to keep the saved one."
            : "Only owners and administrators can change these settings."
        }
        className="max-w-3xl"
      >
        <form
          onSubmit={onSubmit}
          noValidate
          autoComplete="off"
          className="flex flex-col gap-6"
        >
          {meta.fields.map((field) => (
            <IntegrationField
              key={field.name}
              id={fieldId(key, field.name)}
              field={field}
              value={values[field.name]}
              secret={secrets[field.name] ?? ""}
              secretState={dto.secrets[field.name]}
              error={errors[field.name]}
              disabled={!canEdit}
              onChange={(value) => set(field.name, value)}
              onSecretChange={(value) =>
                setSecrets((prev) => ({ ...prev, [field.name]: value }))
              }
            />
          ))}

          {formError ? (
            <p
              role="alert"
              className="flex items-start gap-2 text-sm text-destructive"
            >
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {formError}
            </p>
          ) : null}

          {canEdit || (canTest && dto.configured) ? (
            <div className="flex flex-col border-t pt-5">
              <div className="flex flex-wrap items-center gap-3">
                {canEdit ? (
                  <Button
                    type="submit"
                    className={cn(FORM_ACTION, SOFT_DISABLED)}
                    aria-disabled={!canSave || undefined}
                  >
                    {save.isPending ? "Saving…" : "Save"}
                  </Button>
                ) : null}
                {canTest && dto.configured ? (
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(FORM_ACTION, "bg-card", SOFT_DISABLED)}
                    aria-disabled={!canRunTest || undefined}
                    aria-describedby={
                      dirty ? `integration-${slug}-test-note` : undefined
                    }
                    onClick={() => {
                      if (!canRunTest) return
                      setErrors({})
                      test.mutate()
                    }}
                  >
                    Test connection
                  </Button>
                ) : null}
                {canEdit && dto.configured ? (
                  <Button
                    type="button"
                    variant="destructive"
                    className={cn(FORM_ACTION, "sm:ml-auto", SOFT_DISABLED)}
                    aria-disabled={busy || undefined}
                    onClick={() => {
                      if (busy) return
                      disconnected.current = false
                      setConfirmDisconnect(true)
                    }}
                  >
                    Disconnect
                  </Button>
                ) : null}
              </div>
              {dirty && dto.configured && canTest ? (
                <p
                  id={`integration-${slug}-test-note`}
                  className="mt-3 text-xs text-muted-foreground"
                >
                  Save your changes to test them.
                </p>
              ) : null}
              {canTest && dto.configured ? (
                <TestResult pending={test.isPending} outcome={outcome} />
              ) : null}
            </div>
          ) : null}
        </form>
      </FormCard>

      {children}

      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent
          finalFocus={() =>
            disconnected.current ? (statusRef.current ?? true) : true
          }
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {dto.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              The saved settings, including secrets, are deleted. You can set it
              up again at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              className={SOFT_DISABLED}
              aria-disabled={disconnect.isPending || undefined}
              onClick={() => {
                if (!disconnect.isPending) disconnect.mutate()
              }}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function firstErrored(
  fields: readonly FieldMeta[],
  errors: Errors
): string | undefined {
  return fields.find((field) => errors[field.name])?.name
}
