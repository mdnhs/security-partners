import { cn } from "@/lib/utils"

import { FieldError, Label } from "./fields"

/** Several choices from cards (qualifications, shifts); one column below sm. */
export function CheckboxCards({
  id,
  label,
  required,
  error,
  options,
  value,
  onChange,
}: {
  id: string
  label: string
  required?: boolean
  error?: string
  options: string[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  const labelId = `${id}-label`
  const errorId = `${id}-error`
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-describedby={error ? errorId : undefined}
      data-invalid={error ? "" : undefined}
      className="flex flex-col gap-2.5"
    >
      <Label id={labelId} required={required}>
        {label}
      </Label>
      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((option, i) => {
          const checked = value.includes(option)
          return (
            <label
              key={option}
              className={cn(
                "flex min-h-[50px] cursor-pointer items-center gap-3 rounded-xl border px-[17px] py-3 text-[15px] leading-[1.35] text-brand-navy transition-colors",
                checked
                  ? "border-brand-green bg-brand-mint"
                  : "border-brand-line bg-white hover:border-brand-green/60"
              )}
            >
              <input
                type="checkbox"
                id={`${id}-${i}`}
                checked={checked}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...value, option]
                      : value.filter((v) => v !== option)
                  )
                }
                className="size-5 shrink-0 accent-brand-green"
              />
              <span>{option}</span>
            </label>
          )
        })}
      </div>
      <FieldError id={errorId} message={error} />
    </div>
  )
}
