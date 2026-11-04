import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

export const inputClass =
  "w-full rounded-xl border border-brand-line bg-brand-surface px-[18px] text-[15px] text-brand-navy outline-none placeholder:text-brand-placeholder focus-visible:border-brand-blue focus-visible:ring-3 focus-visible:ring-brand-blue/20 aria-invalid:border-red-600 aria-invalid:bg-red-50/40"

export function Label({
  htmlFor,
  id,
  required,
  children,
}: {
  htmlFor?: string
  id?: string
  required?: boolean
  children: React.ReactNode
}) {
  const Tag = htmlFor ? "label" : "span"
  return (
    <Tag
      id={id}
      htmlFor={htmlFor}
      className={cn(
        "text-sm leading-[1.4] font-bold text-brand-navy",
        // Drawn by CSS: the star is not part of the field's name.
        required && "after:ml-1 after:text-red-600 after:content-['*']"
      )}
    >
      {children}
    </Tag>
  )
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="text-sm leading-normal font-bold text-red-700">
      {message}
    </p>
  )
}

type Common = {
  id: string
  label: string
  required?: boolean
  error?: string
  className?: string
}

/** A labelled text, email, tel, date or month input with its error. */
export function TextField({
  id,
  label,
  required,
  error,
  className,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
}: Common & {
  type?: "text" | "email" | "tel" | "date" | "month"
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: string
}) {
  const errorId = `${id}-error`
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || undefined}
          autoComplete={autoComplete}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          data-invalid={error ? "" : undefined}
          className={cn(inputClass, "h-[52px]")}
        />
      </div>
      <FieldError id={errorId} message={error} />
    </div>
  )
}

export function TextAreaField({
  id,
  label,
  error,
  value,
  onChange,
  placeholder,
}: Common & {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        data-invalid={error ? "" : undefined}
        className={cn(inputClass, "h-[130px] resize-y py-4")}
      />
      <FieldError id={errorId} message={error} />
    </div>
  )
}

export function SelectField({
  id,
  label,
  required,
  error,
  className,
  value,
  onChange,
  placeholder,
  options,
}: Common & {
  value: string
  onChange: (value: string) => void
  placeholder: string
  options: string[]
}) {
  const errorId = `${id}-error`
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <div className="relative">
        <select
          id={id}
          name={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          data-invalid={error ? "" : undefined}
          className={cn(
            inputClass,
            "h-[52px] appearance-none pr-12",
            value === "" && "text-brand-placeholder"
          )}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option} value={option} className="text-brand-navy">
              {option}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-[18px] size-[18px] -translate-y-1/2 text-brand-muted"
        />
      </div>
      <FieldError id={errorId} message={error} />
    </div>
  )
}
