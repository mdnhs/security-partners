import { cn } from "@/lib/utils"

import { FieldError, Label } from "./fields"

const columns = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" } as const

/** One choice from cards (Figma: radio cards, green when chosen); one column below sm. */
export function RadioCards<V extends string>({
  id,
  label,
  required,
  error,
  hint,
  cols = 2,
  options,
  value,
  onChange,
}: {
  id: string
  label: string
  required?: boolean
  error?: string
  hint?: string
  cols?: 2 | 3
  options: { value: V; label: string }[]
  value: V | null
  onChange: (value: V) => void
}) {
  const labelId = `${id}-label`
  const errorId = `${id}-error`
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      aria-required={required || undefined}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      data-invalid={error ? "" : undefined}
      className="flex flex-col gap-2.5"
    >
      <Label id={labelId} required={required}>
        {label}
      </Label>
      <div className={cn("grid gap-3", columns[cols])}>
        {options.map((option, i) => {
          const checked = value === option.value
          return (
            <label
              key={option.value}
              className={cn(
                "flex min-h-[50px] cursor-pointer items-center gap-3 rounded-xl border px-[17px] py-3 text-[15px] leading-[1.35] text-brand-navy transition-colors",
                checked
                  ? "border-brand-green bg-brand-mint"
                  : error
                    ? "border-red-600 bg-white"
                    : "border-brand-line bg-white hover:border-brand-green/60"
              )}
            >
              <input
                type="radio"
                id={`${id}-${i}`}
                name={id}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="size-5 shrink-0 accent-brand-green"
              />
              <span>{option.label}</span>
            </label>
          )
        })}
      </div>
      {hint && (
        <p className="text-[13px] leading-normal text-brand-muted">{hint}</p>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  )
}
