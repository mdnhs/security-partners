"use client"

import { LockIcon, LockOpenIcon } from "lucide-react"
import { useState } from "react"
import { HexColorPicker } from "react-colorful"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatOklch, parseColor, toHex } from "@/lib/theme/color"
import { cn } from "@/lib/utils"

export const COLOUR_INVALID = "Use #rrggbb or oklch(L C H) colour"

// A stored colour (or, while nothing is stored, the resolved `fallback`).
// Emits canonical oklch() strings only; typed text commits on blur or Enter,
// and an unparseable value is never handed on.
export function ColourField({
  id,
  label,
  value,
  onChange,
  clearable,
  locked,
  onLockChange,
  description,
  fallback,
  disabled,
}: {
  id: string
  label: string
  value: string | null
  onChange(v: string | null): void
  clearable?: boolean
  locked?: boolean
  onLockChange?(l: boolean): void
  description?: string
  /** Shown (not stored) while `value` is null, e.g. the preset's colour. */
  fallback?: string | null
  disabled?: boolean
}) {
  const current =
    (value && parseColor(value)) || (fallback && parseColor(fallback)) || null
  const hex = current ? toHex(current) : ""
  const [typed, setTyped] = useState<string | null>(null)
  const [error, setError] = useState(false)

  const readoutId = `${id}-readout`
  const descriptionId = `${id}-description`

  const commit = () => {
    if (typed === null) return
    const parsed = parseColor(typed.trim())
    if (!parsed) {
      setError(true)
      return
    }
    setError(false)
    setTyped(null)
    onChange(formatOklch(parsed))
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {description ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger
            disabled={disabled}
            render={
              <button
                type="button"
                aria-label={`Pick ${label}`}
                className={cn(
                  "size-9 shrink-0 rounded-lg border border-foreground/15 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:size-11",
                  !current &&
                    "bg-[repeating-conic-gradient(var(--muted)_0_25%,var(--background)_0_50%)] bg-size-[12px_12px]"
                )}
                style={current ? { backgroundColor: hex } : undefined}
              />
            }
          />
          <PopoverContent align="start" className="w-auto items-center p-3">
            <HexColorPicker
              color={hex || "#000000"}
              onChange={(next) => {
                const parsed = parseColor(next)
                if (!parsed) return
                setTyped(null)
                setError(false)
                onChange(formatOklch(parsed))
              }}
            />
          </PopoverContent>
        </Popover>
        <Input
          id={id}
          value={typed ?? hex}
          disabled={disabled}
          aria-invalid={error || undefined}
          aria-describedby={
            description ? `${readoutId} ${descriptionId}` : readoutId
          }
          spellCheck={false}
          autoComplete="off"
          placeholder="#rrggbb"
          className="min-w-0 font-mono pointer-coarse:h-11"
          onChange={(event) => {
            setTyped(event.target.value)
            setError(false)
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              commit()
            }
          }}
        />
        {clearable && value && !disabled ? (
          <Button
            type="button"
            variant="ghost"
            aria-label={`Clear ${label}`}
            className="pointer-coarse:h-11"
            onClick={() => {
              setTyped(null)
              setError(false)
              onChange(null)
            }}
          >
            Clear
          </Button>
        ) : null}
        {onLockChange ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Lock ${label}`}
            aria-pressed={!!locked}
            disabled={disabled}
            className="pointer-coarse:size-11"
            onClick={() => onLockChange(!locked)}
          >
            {locked ? <LockIcon aria-hidden /> : <LockOpenIcon aria-hidden />}
          </Button>
        ) : null}
      </div>
      <p
        id={readoutId}
        aria-live="polite"
        className={cn(
          "truncate text-xs",
          error ? "text-danger" : "text-muted-foreground"
        )}
      >
        {error
          ? COLOUR_INVALID
          : current
            ? `${formatOklch(current)} · ${hex}`
            : "Not set"}
      </p>
    </div>
  )
}
