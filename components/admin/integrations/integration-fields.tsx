"use client"

import { CheckCircle2, CircleAlert, KeyRound, LoaderCircle } from "lucide-react"
import type { ReactNode } from "react"

import { ADMIN_CONTROL } from "@/components/admin/form/form-ui"
import { NativeSelect } from "@/components/admin/schema-form/widgets/basic"
import {
  describedBy,
  ErrorText,
  FieldShell,
  HelpText,
  LABEL_CLASS,
} from "@/components/admin/schema-form/widgets/field-shell"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import type { Role } from "@/lib/auth/roles"
import type { SecretState } from "@/lib/schemas/api/integrations"
import { cn } from "@/lib/utils"

import { type FieldMeta, ROLE_NAMES } from "./integration-meta"

/**
 * Keeps password managers from filling or saving credentials here: these
 * are a service's secrets, not the admin user's sign-in.
 */
export const NO_PASSWORD_MANAGER = {
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
} as const

/** The secret's saved state as text; the secret itself never reaches the page. */
export function secretStateText(state: SecretState | undefined): string {
  if (!state?.set) return "Not saved yet"
  const last4 = state.hint?.replace(/^•+/, "")
  return last4 ? `Saved · ends in ${last4}` : "Saved"
}

/**
 * The result of "Test connection": a polite live region that exists before
 * any result, so screen readers announce what lands in it. Only the
 * server's fixed `message` is shown.
 */
export function TestResult({
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

export function IntegrationField({
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
                aria-invalid={invalid}
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
        {...NO_PASSWORD_MANAGER}
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
        {...(field.ignorePasswordManagers ? NO_PASSWORD_MANAGER : {})}
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
