"use client"

import { Info, Plus, Trash2 } from "lucide-react"

import { MAX_HISTORY_PERIODS } from "@/lib/schemas/api/applications"
import { interpolate } from "@/lib/interpolate"
import type { CareersTemplate } from "@/templates/careers/schema"

import { TextField } from "./fields"

export type Period = {
  key: string
  employer: string
  role: string
  from: string
  to: string
  reason: string
}

export const emptyPeriod = (): Period => ({
  key: crypto.randomUUID(),
  employer: "",
  role: "",
  from: "",
  to: "",
  reason: "",
})

type Copy = CareersTemplate["apply"]

/** The 5-year history (Figma 550:665): one card per period, newest first. */
export function HistoryPeriods({
  copy,
  periods,
  errors,
  onChange,
}: {
  copy: Copy
  periods: Period[]
  errors: Record<string, string>
  onChange: (periods: Period[]) => void
}) {
  const f = copy.fields
  const set = (i: number, patch: Partial<Period>) =>
    onChange(periods.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  return (
    <div className="flex flex-col gap-5">
      <p className="flex items-start gap-3 rounded-xl border border-brand-blue/20 bg-brand-blue/5 px-4 py-3.5 text-sm leading-normal text-brand-ink">
        <Info aria-hidden className="mt-px size-5 shrink-0 text-brand-blue" />
        <span>{copy.hints.history}</span>
      </p>
      {periods.map((period, i) => {
        const id = (name: string) => `history-${i}-${name}`
        const err = (name: string) => errors[`history.${i}.${name}`]
        return (
          <fieldset
            key={period.key}
            aria-labelledby={id("title")}
            className="flex flex-col gap-4 rounded-2xl border border-brand-line bg-white p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <p
                id={id("title")}
                className="text-base font-black text-brand-navy"
              >
                {interpolate(copy.hints.period, { n: i + 1 })}
              </p>
              {i === 0 ? (
                <span className="text-sm text-brand-muted">
                  {copy.hints.mostRecent}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onChange(periods.filter((_, j) => j !== i))}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-brand-muted hover:text-red-700"
                >
                  <Trash2 aria-hidden className="size-4" />
                  {copy.hints.removePeriod}
                </button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id={id("employer")}
                label={f.employer.label}
                placeholder={f.employer.placeholder}
                required
                value={period.employer}
                onChange={(employer) => set(i, { employer })}
                error={err("employer")}
              />
              <TextField
                id={id("role")}
                label={f.role.label}
                placeholder={f.role.placeholder}
                value={period.role}
                onChange={(role) => set(i, { role })}
                error={err("role")}
              />
              <TextField
                id={id("from")}
                type="month"
                label={f.from.label}
                required
                value={period.from}
                onChange={(from) => set(i, { from })}
                error={err("from")}
              />
              <TextField
                id={id("to")}
                type="month"
                label={f.to.label}
                placeholder={f.to.placeholder}
                value={period.to}
                onChange={(to) => set(i, { to })}
                error={err("to")}
              />
            </div>
            <TextField
              id={id("reason")}
              label={f.reason.label}
              placeholder={f.reason.placeholder}
              value={period.reason}
              onChange={(reason) => set(i, { reason })}
              error={err("reason")}
            />
          </fieldset>
        )
      })}
      {periods.length < MAX_HISTORY_PERIODS && (
        <button
          type="button"
          onClick={() => onChange([...periods, emptyPeriod()])}
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl border-[1.5px] border-dashed border-brand-green px-5 text-[15px] font-bold text-brand-green-dark hover:bg-brand-mint max-sm:w-full max-sm:justify-center"
        >
          <Plus aria-hidden className="size-[18px]" />
          {copy.hints.addPeriod}
        </button>
      )}
    </div>
  )
}
