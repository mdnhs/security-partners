"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  KeyRound,
  LoaderCircle,
} from "lucide-react"
import Link from "next/link"
import { type FormEvent, type ReactNode, useEffect, useState } from "react"
import { toast } from "sonner"

import { UnsavedGuard } from "@/components/admin/editor/unsaved-guard"
import { ADMIN_CONTROL, FormCard } from "@/components/admin/form/form-ui"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { RelativeTime } from "@/components/admin/kit/relative-time"
import { CardSkeleton } from "@/components/admin/kit/skeletons"
import { StatusPill } from "@/components/admin/kit/status-pill"
import { FORM_ACTION, PageHeader } from "@/components/admin/page-header"
import { NativeSelect } from "@/components/admin/schema-form/widgets/basic"
import {
  describedBy,
  ErrorText,
  FieldShell,
  HelpText,
  LABEL_CLASS,
} from "@/components/admin/schema-form/widgets/field-shell"
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
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { usePermission } from "@/hooks/use-permission"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import type { Role } from "@/lib/auth/roles"
import type {
  IntegrationDto,
  IntegrationTestResult,
  SecretState,
} from "@/lib/schemas/api/integrations"
import { INTEGRATIONS, type IntegrationKey } from "@/lib/schemas/integrations"
import { cn } from "@/lib/utils"

import {
  type FieldMeta,
  INTEGRATION_FORMS,
  ROLE_NAMES,
} from "./integration-meta"

type Values = Record<string, unknown>
type Errors = Record<string, string>

/** Toast after a 409 with the current record: the form now shows it. */
export const CONFLICT_MESSAGE =
  "Someone else changed these settings — the form now shows their version."

const fieldId = (key: IntegrationKey, name: string) =>
  `${key.replace(".", "-")}-${name}`

/** The secret's saved state as text; the secret itself never reaches the page. */
export function secretStateText(state: SecretState | undefined): string {
  if (!state?.set) return "Not saved yet"
  const last4 = state.hint?.replace(/^•+/, "")
  return last4 ? `Saved · ends in ${last4}` : "Saved"
}

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
      setConfirmDisconnect(false)
      await queryClient.invalidateQueries({ queryKey: ["integrations"] })
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
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

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setErrors({})
    setFormError(null)
    save.mutate()
  }
  const set = (name: string, value: unknown) =>
    setValues((prev) => ({ ...prev, [name]: value }))
  const slug = dto.slug
  const busy = save.isPending || disconnect.isPending

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
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          {meta.fields.map((field) => (
            <Field
              key={field.name}
              id={fieldId(key, field.name)}
              field={field}
              value={values[field.name]}
              secret={secrets[field.name] ?? ""}
              secretState={dto.secrets[field.name]}
              error={errors[field.name]}
              disabled={!canEdit || busy}
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
                    className={FORM_ACTION}
                    disabled={!dirty || busy}
                  >
                    {save.isPending ? "Saving…" : "Save"}
                  </Button>
                ) : null}
                {canTest && dto.configured ? (
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(FORM_ACTION, "bg-card")}
                    disabled={dirty || busy || test.isPending}
                    aria-describedby={
                      dirty ? `integration-${slug}-test-note` : undefined
                    }
                    onClick={() => {
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
                    className={cn(FORM_ACTION, "sm:ml-auto")}
                    disabled={busy}
                    onClick={() => setConfirmDisconnect(true)}
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
        <AlertDialogContent>
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
              disabled={disconnect.isPending}
              onClick={() => disconnect.mutate()}
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

/**
 * The result of "Test connection": a polite live region that exists before
 * any result, so screen readers announce what lands in it. Only the
 * server's fixed `message` is shown.
 */
function TestResult({
  pending,
  outcome,
}: {
  pending: boolean
  outcome: { ok: boolean; message: string } | null
}) {
  const failed = outcome ? !outcome.ok : false
  return (
    <div role="status" aria-live="polite" aria-label="Connection test">
      {pending ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle
            aria-hidden
            className="size-4 animate-spin motion-reduce:animate-none"
          />
          Testing the connection…
        </p>
      ) : outcome ? (
        <p
          className={cn(
            "mt-3 flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm",
            failed
              ? "bg-danger-soft text-danger"
              : "bg-success-soft text-success"
          )}
        >
          {failed ? (
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          ) : (
            <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
          )}
          <span>
            <span className="font-semibold">
              {failed ? "Test failed" : "Test passed"}
            </span>
            {" — "}
            {outcome.message}
          </span>
        </p>
      ) : null}
    </div>
  )
}

function Field({
  id,
  field,
  value,
  secret,
  secretState,
  error,
  disabled,
  onChange,
  onSecretChange,
}: {
  id: string
  field: FieldMeta
  value: unknown
  secret: string
  secretState: SecretState | undefined
  error: string | undefined
  disabled: boolean
  onChange: (value: unknown) => void
  onSecretChange: (value: string) => void
}) {
  const help = field.help
  const invalid = error ? true : undefined

  if (field.kind === "toggle")
    return (
      <div
        data-invalid={invalid}
        className="flex min-h-16 items-center justify-between gap-4 rounded-xl border bg-background px-4 py-3 shadow-xs"
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <label htmlFor={id} className={LABEL_CLASS}>
            {field.label}
          </label>
          {help ? <HelpText id={`${id}-help`}>{help}</HelpText> : null}
          {error ? <ErrorText id={`${id}-error`}>{error}</ErrorText> : null}
        </div>
        <Switch
          id={id}
          checked={value === true}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={describedBy(id, { help, error })}
          onCheckedChange={(checked) => onChange(checked)}
        />
      </div>
    )

  if (field.kind === "roles") {
    const selected = Array.isArray(value) ? (value as Role[]) : []
    return (
      <fieldset
        className="flex flex-col gap-1"
        aria-describedby={describedBy(id, { help, error })}
        aria-invalid={invalid}
        disabled={disabled}
      >
        <legend className={cn(LABEL_CLASS, "mb-0.5")}>{field.label}</legend>
        {help ? <HelpText id={`${id}-help`}>{help}</HelpText> : null}
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
          {field.roles.map((role) => (
            <label
              key={role}
              htmlFor={`${id}-${role}`}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm transition-colors hover:bg-muted/60 has-checked:bg-primary/5 has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                disabled && "cursor-default opacity-70 hover:bg-transparent"
              )}
            >
              <input
                id={`${id}-${role}`}
                type="checkbox"
                className="size-4 shrink-0 accent-primary outline-none"
                checked={selected.includes(role)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? field.roles.filter(
                          (r) => r === role || selected.includes(r)
                        )
                      : selected.filter((r) => r !== role)
                  )
                }
              />
              {ROLE_NAMES[role]}
            </label>
          ))}
        </div>
        {error ? <ErrorText id={`${id}-error`}>{error}</ErrorText> : null}
      </fieldset>
    )
  }

  let control: ReactNode
  let extra: ReactNode = null
  let extraId: string | undefined
  if (field.kind === "select") {
    control = (
      <NativeSelect
        id={id}
        value={String(value ?? "")}
        disabled={disabled}
        invalid={!!error}
        describedBy={describedBy(id, { help, error })}
        onChange={onChange}
      >
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    )
  } else if (field.kind === "secret") {
    extraId = `${id}-saved`
    extra = (
      <p
        id={extraId}
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <KeyRound aria-hidden className="size-3.5 shrink-0" />
        <span>{secretStateText(secretState)}</span>
      </p>
    )
    control = (
      <Input
        id={id}
        type="password"
        autoComplete="new-password"
        spellCheck={false}
        className={ADMIN_CONTROL}
        value={secret}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy(id, { help, error, extraId })}
        onChange={(e) => onSecretChange(e.target.value)}
      />
    )
  } else if (field.kind === "number") {
    control = (
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        step={1}
        min={field.min}
        max={field.max}
        className={cn(ADMIN_CONTROL, "w-36")}
        value={typeof value === "number" && Number.isFinite(value) ? value : ""}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy(id, { help, error })}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
      />
    )
  } else {
    control = (
      <Input
        id={id}
        type={field.type ?? "text"}
        autoComplete={field.autoComplete}
        spellCheck={false}
        placeholder={field.placeholder}
        className={ADMIN_CONTROL}
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy(id, { help, error })}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }

  return (
    <FieldShell
      id={id}
      label={field.label}
      help={help}
      error={error}
      optional={field.kind === "text" && field.optional}
      extra={extra}
    >
      {control}
    </FieldShell>
  )
}
