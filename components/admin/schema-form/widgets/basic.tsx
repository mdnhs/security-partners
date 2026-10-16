"use client"

import { useEffect } from "react"
import { useController, useFormContext, useWatch } from "react-hook-form"
import type { z } from "zod"

import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { fieldId, useSchemaForm, type WidgetProps } from "../context"
import { describedBy, errorText, FieldShell } from "./field-shell"

/**
 * "" → null for nullable / optional strings (a cleared optional is null
 * inside the form and dropped on the way out, see optional-values.ts).
 */
function emptyAs(field: WidgetProps["field"], value: string) {
  if (value !== "") return value
  return field.nullable || field.optional ? null : ""
}

/** meta.composeFrom: siblings joined, or undefined while the first is empty. */
function compose(
  parent: unknown,
  keys: string[] | undefined
): string | undefined {
  if (!keys?.length || typeof parent !== "object" || parent === null)
    return undefined
  const values = keys.map((key) => (parent as Record<string, unknown>)[key])
  const [first] = values
  if (first === undefined || first === null || first === "") return undefined
  if (typeof first === "number" && !Number.isFinite(first)) return undefined
  return values.map((value) => (value == null ? "" : String(value))).join("")
}

/**
 * Keeps a composed field (meta.composeFrom) equal to its siblings, so e.g.
 * a hero stat's text can never drift from the number it counts up to.
 */
function useComposedValue(
  field: WidgetProps["field"],
  path: string
): string | undefined {
  const keys = field.meta.composeFrom
  const parentPath = path.slice(0, Math.max(0, path.lastIndexOf(".")))
  const parent = useWatch({ name: parentPath || path, disabled: !keys })
  const { getValues, setValue } = useFormContext()
  const composed = compose(parent, keys)
  useEffect(() => {
    if (composed === undefined || getValues(path) === composed) return
    setValue(path, composed, { shouldDirty: true, shouldValidate: true })
  }, [composed, path, getValues, setValue])
  return composed
}

export function TextWidget({ field, path }: WidgetProps) {
  const { idPrefix, disabled } = useSchemaForm()
  const {
    field: { value, onChange, onBlur, ref },
    fieldState,
  } = useController({ name: path })
  const composed = useComposedValue(field, path)
  const id = fieldId(idPrefix, path)
  const error = errorText(fieldState.error)
  const help = field.meta.help
  return (
    <FieldShell
      id={id}
      label={field.label}
      help={help}
      error={error}
      optional={field.optional || field.nullable}
    >
      <Input
        id={id}
        name={path}
        type={
          field.format === "email"
            ? "email"
            : field.format === "url"
              ? "url"
              : "text"
        }
        value={composed ?? (value as string | null | undefined) ?? ""}
        readOnly={composed !== undefined}
        placeholder={field.meta.placeholder}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, { help, error })}
        onChange={(event) => onChange(emptyAs(field, event.target.value))}
        onBlur={onBlur}
        ref={ref}
      />
    </FieldShell>
  )
}

export function TextareaWidget({ field, path }: WidgetProps) {
  const { idPrefix, disabled } = useSchemaForm()
  const {
    field: { value, onChange, onBlur, ref },
    fieldState,
  } = useController({ name: path })
  const id = fieldId(idPrefix, path)
  const error = errorText(fieldState.error)
  const help = field.meta.help
  const text = (value as string | null | undefined) ?? ""
  const max =
    field.meta.maxLength ?? (field.schema as z.ZodString).maxLength ?? null
  const counterId = `${id}-count`
  return (
    <FieldShell
      id={id}
      label={field.label}
      help={help}
      error={error}
      optional={field.optional || field.nullable}
      extra={
        <p
          id={counterId}
          aria-live="polite"
          className={cn(
            "text-right text-xs text-muted-foreground tabular-nums",
            max !== null && text.length > max && "text-destructive"
          )}
        >
          {max === null
            ? `${text.length} characters`
            : `${text.length} / ${max}`}
        </p>
      }
    >
      <Textarea
        id={id}
        name={path}
        rows={field.meta.rows ?? 3}
        value={text}
        placeholder={field.meta.placeholder}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, { help, error, extraId: counterId })}
        onChange={(event) => onChange(emptyAs(field, event.target.value))}
        onBlur={onBlur}
        ref={ref}
      />
    </FieldShell>
  )
}

export function NumberWidget({ field, path }: WidgetProps) {
  const { idPrefix, disabled } = useSchemaForm()
  const {
    field: { value, onChange, onBlur, ref },
    fieldState,
  } = useController({ name: path })
  const id = fieldId(idPrefix, path)
  const error = errorText(fieldState.error)
  const help = field.meta.help
  const schema = field.schema as z.ZodNumber
  return (
    <FieldShell
      id={id}
      label={field.label}
      help={help}
      error={error}
      optional={field.optional || field.nullable}
    >
      <Input
        id={id}
        name={path}
        type="number"
        inputMode="numeric"
        className="max-w-40"
        min={schema.minValue ?? undefined}
        max={schema.maxValue ?? undefined}
        step={schema.isInt ? 1 : "any"}
        value={typeof value === "number" && !Number.isNaN(value) ? value : ""}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, { help, error })}
        onChange={(event) => {
          const raw = event.target.value
          onChange(
            raw === ""
              ? field.nullable || field.optional
                ? null
                : Number.NaN
              : Number(raw)
          )
        }}
        onBlur={onBlur}
        ref={ref}
      />
    </FieldShell>
  )
}

export function ToggleWidget({ field, path }: WidgetProps) {
  const { idPrefix, disabled } = useSchemaForm()
  const {
    field: { value, onChange, onBlur },
    fieldState,
  } = useController({ name: path })
  const id = fieldId(idPrefix, path)
  const error = errorText(fieldState.error)
  const help = field.meta.help
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-sm font-medium">
          {field.label}
        </label>
        {help ? (
          <p id={`${id}-help`} className="text-sm text-muted-foreground">
            {help}
          </p>
        ) : null}
        {error ? (
          <p
            id={`${id}-error`}
            role="alert"
            className="text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={!!value}
        disabled={disabled}
        aria-describedby={describedBy(id, { help, error })}
        onCheckedChange={(checked) => onChange(checked)}
        onBlur={onBlur}
      />
    </div>
  )
}

export function SelectWidget({ field, path }: WidgetProps) {
  const { idPrefix, disabled } = useSchemaForm()
  const {
    field: { value, onChange, onBlur },
    fieldState,
  } = useController({ name: path })
  const id = fieldId(idPrefix, path)
  const error = errorText(fieldState.error)
  const help = field.meta.help
  const values = (field.schema as z.ZodEnum).options as string[]
  const labelOf = (value: string) =>
    field.meta.options?.find((o) => o.value === value)?.label ?? value
  return (
    <FieldShell
      id={id}
      label={field.label}
      help={help}
      error={error}
      optional={field.optional || field.nullable}
    >
      <NativeSelect
        id={id}
        value={(value as string | null | undefined) ?? ""}
        disabled={disabled}
        invalid={!!error}
        describedBy={describedBy(id, { help, error })}
        onChange={(value) => onChange(value === "" ? null : value)}
        onBlur={onBlur}
      >
        {field.optional || field.nullable ? (
          <option value="">— None —</option>
        ) : null}
        {values.map((value) => (
          <option key={value} value={value}>
            {labelOf(value)}
          </option>
        ))}
      </NativeSelect>
    </FieldShell>
  )
}

/** Styled native <select>: accessible and keyboard-friendly everywhere. */
export function NativeSelect({
  id,
  value,
  onChange,
  onBlur,
  disabled,
  invalid,
  describedBy: ariaDescribedBy,
  children,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
  children: React.ReactNode
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-describedby={ariaDescribedBy}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      className="h-8 w-full max-w-md rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30"
    >
      {children}
    </select>
  )
}
