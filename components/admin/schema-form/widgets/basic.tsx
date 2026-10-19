"use client"

import {
  ChevronDown,
  Clock,
  Globe,
  type LucideIcon,
  Mail,
  MapPin,
  Phone,
} from "lucide-react"
import { useEffect } from "react"
import { useController, useFormContext, useWatch } from "react-hook-form"
import type { z } from "zod"

import { ADMIN_CONTROL, ADMIN_TEXTAREA } from "@/components/admin/form/form-ui"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { fieldId, useSchemaForm, type WidgetProps } from "../context"
import type { LeadingIcon } from "../editor-meta"
import {
  describedBy,
  ErrorText,
  errorText,
  FieldShell,
  HelpText,
  LABEL_CLASS,
} from "./field-shell"

const ICONS: Record<LeadingIcon, LucideIcon> = {
  phone: Phone,
  email: Mail,
  url: Globe,
  clock: Clock,
  map: MapPin,
}

/** An input with a decorative icon before the value (pad the input: pl-9). */
export function WithLeadingIcon({
  icon,
  children,
}: {
  icon: LeadingIcon | null
  children: React.ReactNode
}) {
  if (!icon) return children
  const Icon = ICONS[icon]
  return (
    <div className="relative">
      <Icon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      {children}
    </div>
  )
}

/** aria-required for a field that must have a value. */
const required = (field: WidgetProps["field"]) =>
  !(field.optional || field.nullable) || undefined

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
      <WithLeadingIcon icon={field.icon}>
        <Input
          id={id}
          name={path}
          className={cn(ADMIN_CONTROL, field.icon && "pl-9")}
          aria-required={required(field)}
          type={
            field.format === "email"
              ? "email"
              : field.format === "url"
                ? "url"
                : "text"
          }
          value={composed ?? (value as string | null | undefined) ?? ""}
          readOnly={composed !== undefined || field.meta.readOnly}
          placeholder={field.meta.placeholder}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={describedBy(id, { help, error })}
          onChange={(event) => onChange(emptyAs(field, event.target.value))}
          onBlur={onBlur}
          ref={ref}
        />
      </WithLeadingIcon>
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
        className={ADMIN_TEXTAREA}
        aria-required={required(field)}
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
        className={ADMIN_CONTROL}
        aria-required={required(field)}
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
    field: { value, onChange, onBlur, ref },
    fieldState,
  } = useController({ name: path })
  const id = fieldId(idPrefix, path)
  const error = errorText(fieldState.error)
  const help = field.meta.help
  return (
    <div
      data-invalid={error ? true : undefined}
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
        ref={ref}
        checked={!!value}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, { help, error })}
        onCheckedChange={(checked) => onChange(checked)}
        onBlur={onBlur}
      />
    </div>
  )
}

/**
 * Styled native <select> for admin forms outside SchemaForm (SchemaForm's
 * own choices use the shadcn primitives, see ./choice.tsx).
 */
export function NativeSelect({
  id,
  value,
  onChange,
  onBlur,
  disabled,
  invalid,
  describedBy: ariaDescribedBy,
  selectRef,
  children,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
  /** react-hook-form field ref (focus on error). */
  selectRef?: React.Ref<HTMLSelectElement>
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <select
        id={id}
        ref={selectRef}
        value={value}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={ariaDescribedBy}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className="h-10 w-full appearance-none rounded-lg border border-input bg-background py-0 pr-9 pl-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30"
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
}
