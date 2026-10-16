"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** List-filter control (JW toolbar): 40 px, rounded-xl, white, 44 px on touch. */
export const FILTER_CONTROL =
  "h-10 rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-11"
export const FILTER_LABEL = "text-xs font-medium text-muted-foreground"

/** Labelled native <select> for list filters (keyboard and screen-reader friendly). */
export function FilterSelect({
  id,
  label,
  value,
  onChange,
  className,
  children,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className={FILTER_LABEL}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(FILTER_CONTROL, "min-w-36")}
      >
        {children}
      </select>
    </div>
  )
}

/** Labelled native <input> for list filters (text with suggestions, or date). */
export function FilterInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  suggestions,
  placeholder,
  className,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: "text" | "date"
  /** Shown as a <datalist>; any text is still accepted. */
  suggestions?: readonly string[]
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className={FILTER_LABEL}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        list={suggestions ? `${id}-options` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cn(FILTER_CONTROL, "w-44 placeholder:text-muted-foreground")}
      />
      {suggestions ? (
        <datalist id={`${id}-options`}>
          {suggestions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      ) : null}
    </div>
  )
}
