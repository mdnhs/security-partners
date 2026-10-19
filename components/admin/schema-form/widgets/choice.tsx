"use client"

import { useController } from "react-hook-form"

import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

import { fieldId, useSchemaForm, type WidgetProps } from "../context"
import { enumValues } from "../resolve-widget"
import {
  describedBy,
  ErrorText,
  errorText,
  FieldShell,
  HelpText,
  LABEL_CLASS,
} from "./field-shell"

export type ChoiceItem = { value: string; label: string }

/** Label of an enum value from meta.options, else the value itself. */
function choiceItems(field: WidgetProps["field"], values: string[]) {
  return values.map((value) => ({
    value,
    label: field.meta.options?.find((o) => o.value === value)?.label ?? value,
  }))
}

const NONE = "— None —"

/**
 * shadcn Select for one value (labelled by FieldShell's <label for=id>).
 * `null` is "nothing chosen": a "— None —" item when `allowNone`.
 * The trigger takes RHF's ref, so a failed submit focuses it.
 */
export function ChoiceSelect({
  id,
  value,
  items,
  onChange,
  onBlur,
  allowNone,
  noneLabel = NONE,
  disabled,
  invalid,
  required,
  describedBy: ariaDescribedBy,
  triggerRef,
}: {
  id: string
  value: string | null
  items: ChoiceItem[]
  onChange: (value: string | null) => void
  onBlur?: () => void
  allowNone?: boolean
  noneLabel?: string
  disabled?: boolean
  invalid?: boolean
  required?: boolean
  describedBy?: string
  triggerRef?: React.Ref<HTMLButtonElement>
}) {
  // Base UI shows the raw value unless `items` maps values to labels.
  const all: { value: string | null; label: string }[] = allowNone
    ? [{ value: null, label: noneLabel }, ...items]
    : items
  return (
    <Select
      items={all}
      value={value}
      disabled={disabled}
      onValueChange={(next) => onChange((next as string | null) ?? null)}
    >
      <SelectTrigger
        id={id}
        ref={triggerRef}
        className="w-full rounded-lg bg-background px-3 shadow-xs data-[size=default]:h-10"
        aria-invalid={invalid || undefined}
        aria-required={required || undefined}
        aria-describedby={ariaDescribedBy}
        onBlur={onBlur}
      >
        <SelectValue placeholder={allowNone ? noneLabel : "Choose…"} />
      </SelectTrigger>
      <SelectContent>
        {all.map((item) => (
          <SelectItem key={item.value ?? ""} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** An enum as a shadcn Select (meta.widget "select", or by default). */
export function SelectWidget({ field, path }: WidgetProps) {
  const { idPrefix, disabled } = useSchemaForm()
  const {
    field: { value, onChange, onBlur, ref },
    fieldState,
  } = useController({ name: path })
  const id = fieldId(idPrefix, path)
  const error = errorText(fieldState.error)
  const help = field.meta.help
  const optional = field.optional || field.nullable
  return (
    <FieldShell
      id={id}
      label={field.label}
      help={help}
      error={error}
      optional={optional}
    >
      <ChoiceSelect
        id={id}
        value={(value as string | null | undefined) ?? null}
        items={choiceItems(field, enumValues(field.schema) ?? [])}
        allowNone={optional}
        disabled={disabled}
        invalid={!!error}
        required={!optional}
        describedBy={describedBy(id, { help, error })}
        triggerRef={ref}
        onChange={onChange}
        onBlur={onBlur}
      />
    </FieldShell>
  )
}

/**
 * A choice group's frame: <fieldset> named by its <legend>, hint and error
 * below the legend (ids `${id}-help` / `${id}-error`).
 */
function ChoiceFieldset({
  id,
  label,
  help,
  error,
  optional,
  children,
}: {
  id: string
  label: string
  help?: string
  error?: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <fieldset
      data-invalid={error ? true : undefined}
      className="flex min-w-0 flex-col gap-2"
    >
      <legend id={`${id}-legend`} className={cn(LABEL_CLASS, "mb-0.5")}>
        {label}
        {optional ? (
          <span className="ml-1 font-normal text-muted-foreground">
            (optional)
          </span>
        ) : null}
      </legend>
      {help ? <HelpText id={`${id}-help`}>{help}</HelpText> : null}
      {children}
      {error ? <ErrorText id={`${id}-error`}>{error}</ErrorText> : null}
    </fieldset>
  )
}

/** One option row: the control and its text, the whole row clickable. */
const OPTION_ROW =
  "flex min-h-8 cursor-pointer items-center gap-2.5 text-sm pointer-coarse:min-h-11 has-disabled:cursor-not-allowed has-disabled:opacity-50"

/** An enum with ≤ 4 options as a shadcn RadioGroup (meta.widget "radio"). */
export function RadioWidget({ field, path }: WidgetProps) {
  const { idPrefix, disabled } = useSchemaForm()
  const {
    field: { value, onChange, onBlur, ref },
    fieldState,
  } = useController({ name: path })
  const id = fieldId(idPrefix, path)
  const error = errorText(fieldState.error)
  const help = field.meta.help
  const optional = field.optional || field.nullable
  const items = choiceItems(field, enumValues(field.schema) ?? [])
  // "" is the "None" radio of an optional field (null in the form).
  const all = optional ? [{ value: "", label: "None" }, ...items] : items
  const current = (value as string | null | undefined) ?? (optional ? "" : null)
  // RHF focuses the checked radio (else the first) on a failed submit.
  const focusIndex = Math.max(
    0,
    all.findIndex((item) => item.value === current)
  )
  return (
    <ChoiceFieldset
      id={id}
      label={field.label}
      help={help}
      error={error}
      optional={optional}
    >
      <RadioGroup
        id={id}
        value={current}
        disabled={disabled}
        aria-labelledby={`${id}-legend`}
        aria-describedby={describedBy(id, { help, error })}
        aria-invalid={error ? true : undefined}
        aria-required={!optional || undefined}
        onValueChange={(next) =>
          onChange(next === "" ? null : (next as string))
        }
        onBlur={onBlur}
        className="gap-1"
      >
        {all.map((item, index) => (
          <label key={item.value} className={OPTION_ROW}>
            <RadioGroupItem
              value={item.value}
              ref={index === focusIndex ? ref : undefined}
              aria-invalid={error ? true : undefined}
            />
            {item.label}
          </label>
        ))}
      </RadioGroup>
    </ChoiceFieldset>
  )
}

/**
 * An array of an enum (e.g. roles) as a checkbox group. The value is kept
 * in option order and holds each option once.
 */
export function CheckboxesWidget({ field, path }: WidgetProps) {
  const { idPrefix, disabled } = useSchemaForm()
  const {
    field: { value, onChange, onBlur, ref },
    fieldState,
  } = useController({ name: path })
  const id = fieldId(idPrefix, path)
  const error = errorText(fieldState.error)
  const help = field.meta.help
  const element = (field.schema as unknown as { def: { element: never } }).def
    .element
  const items = choiceItems(field, enumValues(element) ?? [])
  const chosen = Array.isArray(value) ? (value as string[]) : []
  const toggle = (option: string, checked: boolean) => {
    const next = new Set(chosen)
    if (checked) next.add(option)
    else next.delete(option)
    onChange(items.map((item) => item.value).filter((v) => next.has(v)))
  }
  return (
    <ChoiceFieldset
      id={id}
      label={field.label}
      help={help}
      error={error}
      optional={field.optional || field.nullable}
    >
      <div className="grid gap-1 sm:grid-cols-2">
        {items.map((item, index) => (
          <label key={item.value} className={OPTION_ROW}>
            <Checkbox
              ref={index === 0 ? ref : undefined}
              checked={chosen.includes(item.value)}
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy(id, { help, error })}
              onCheckedChange={(checked) => toggle(item.value, checked)}
              onBlur={onBlur}
            />
            {item.label}
          </label>
        ))}
      </div>
    </ChoiceFieldset>
  )
}
