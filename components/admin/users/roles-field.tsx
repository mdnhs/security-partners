"use client"

import { ErrorText } from "@/components/admin/schema-form/widgets/field-shell"
import { Checkbox } from "@/components/ui/checkbox"
import { ROLE_INFO } from "@/lib/admin/user-roles"
import type { Role } from "@/lib/auth/roles"
import { cn } from "@/lib/utils"

/**
 * Role checkboxes (multi-select). Only `options` are offered: non-owners
 * never see "Owner" (the API refuses it anyway). Each row is one 44 px+
 * label, so the whole line toggles the box (WCAG 2.5.8).
 */
export function RolesField({
  id,
  options,
  value,
  onChange,
  error,
  disabled,
}: {
  id: string
  options: readonly Role[]
  value: readonly Role[]
  onChange: (roles: Role[]) => void
  error?: string
  disabled?: boolean
}) {
  return (
    <fieldset
      className="flex flex-col gap-1"
      aria-describedby={error ? `${id}-error` : undefined}
      aria-invalid={error ? true : undefined}
      disabled={disabled}
    >
      <legend className="mb-2 text-sm font-medium">Roles</legend>
      {options.map((role) => {
        const inputId = `${id}-${role}`
        return (
          <label
            key={role}
            className={cn(
              "-mx-2 flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60 has-data-checked:bg-primary/5",
              disabled && "cursor-default opacity-70 hover:bg-transparent"
            )}
          >
            {/* The wrapping label names the checkbox (Base UI links it). */}
            <Checkbox
              className="mt-0.5"
              checked={value.includes(role)}
              disabled={disabled}
              aria-describedby={`${inputId}-help`}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? options.filter((r) => r === role || value.includes(r))
                    : value.filter((r) => r !== role)
                )
              }
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm leading-tight font-medium">
                {ROLE_INFO[role].label}
              </span>
              {/* Described, not named, by the summary (its id is referenced). */}
              <span
                id={`${inputId}-help`}
                aria-hidden
                className="text-xs leading-relaxed text-muted-foreground"
              >
                {ROLE_INFO[role].description}
              </span>
            </span>
          </label>
        )
      })}
      {error ? <ErrorText id={`${id}-error`}>{error}</ErrorText> : null}
    </fieldset>
  )
}
