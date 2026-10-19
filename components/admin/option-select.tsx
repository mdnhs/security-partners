"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type SelectOption = { value: string; label: string }

/** The admin form-control look on the shadcn Select trigger (40 px, 44 on touch). */
export const ADMIN_SELECT_TRIGGER =
  "w-full rounded-lg bg-background shadow-xs data-[size=default]:h-10"

/**
 * shadcn Select over a flat list of `{ value, label }` options: the admin's
 * replacement for the native select element. Name it with a `<label htmlFor={id}>`
 * (or `aria-label`); the label shows in the trigger through `items`. A value
 * whose option is missing (not loaded yet) shows `placeholder`, not its raw id.
 * `""` is an ordinary option value. In a react-hook-form field pass
 * `triggerRef` (field.ref: a failed submit focuses the trigger) and `onBlur`.
 */
export function OptionSelect({
  id,
  value,
  options,
  onChange,
  disabled,
  className,
  placeholder = "…",
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
  triggerRef,
  onBlur,
}: {
  id?: string
  value: string
  options: readonly SelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  /** Trigger classes. */
  className?: string
  placeholder?: string
  "aria-label"?: string
  "aria-describedby"?: string
  "aria-invalid"?: boolean
  "aria-required"?: boolean
  triggerRef?: React.Ref<HTMLButtonElement>
  onBlur?: () => void
}) {
  return (
    <Select
      items={options}
      value={value}
      disabled={disabled}
      onValueChange={(next) => onChange((next as string | null) ?? "")}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid || undefined}
        aria-required={ariaRequired || undefined}
        ref={triggerRef}
        onBlur={onBlur}
        className={cn(ADMIN_SELECT_TRIGGER, className)}
      >
        <SelectValue>
          {(current: string | null) =>
            options.find((o) => o.value === (current ?? ""))?.label ??
            placeholder
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
