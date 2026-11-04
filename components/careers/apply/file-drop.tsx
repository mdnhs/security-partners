"use client"

import { FileText, Upload, X } from "lucide-react"
import { useState } from "react"

import { MAX_APPLICATION_FILE_BYTES } from "@/lib/schemas/api/applications"
import { cn } from "@/lib/utils"

import { FieldError, Label } from "./fields"

type Props = {
  id: string
  label: string
  required?: boolean
  /** <input accept>; the server checks the bytes anyway. */
  accept: string
  file: File | null
  error?: string
  removeLabel: string
  tooLargeMessage: string
  onChange: (file: File | null, error?: string) => void
}

function pick(
  files: FileList | null,
  { onChange, tooLargeMessage }: Pick<Props, "onChange" | "tooLargeMessage">
) {
  const file = files?.[0]
  if (!file) return
  if (file.size > MAX_APPLICATION_FILE_BYTES) onChange(null, tooLargeMessage)
  else onChange(file)
}

function Chosen({
  file,
  removeLabel,
  onRemove,
}: {
  file: File
  removeLabel: string
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-brand-green bg-brand-mint px-4 py-3">
      <FileText aria-hidden className="size-5 shrink-0 text-brand-green" />
      <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-brand-navy">
        {file.name}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${removeLabel}: ${file.name}`}
        className="flex size-9 items-center justify-center rounded-lg text-brand-muted hover:bg-white hover:text-brand-navy"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  )
}

/** The CV dropzone (Figma 550:833): drag & drop or browse. */
export function FileDrop({
  dropLabel,
  browseLabel,
  typesLabel,
  ...props
}: Props & { dropLabel: string; browseLabel: string; typesLabel: string }) {
  const [over, setOver] = useState(false)
  const errorId = `${props.id}-error`
  return (
    <div
      className="flex flex-col gap-2"
      data-invalid={props.error ? "" : undefined}
    >
      <Label htmlFor={props.id} required={props.required}>
        {props.label}
      </Label>
      {props.file ? (
        <Chosen
          file={props.file}
          removeLabel={props.removeLabel}
          onRemove={() => props.onChange(null)}
        />
      ) : null}
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          pick(e.dataTransfer.files, props)
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors focus-within:ring-3 focus-within:ring-brand-blue/20",
          props.file && "sr-only",
          over
            ? "border-brand-green bg-brand-mint"
            : props.error
              ? "border-red-600 bg-red-50/40"
              : "border-brand-green/50 bg-brand-surface hover:border-brand-green"
        )}
      >
        <span className="flex size-[52px] items-center justify-center rounded-2xl bg-brand-mint text-brand-green">
          <Upload aria-hidden className="size-[23px]" />
        </span>
        <span className="text-base font-bold text-brand-navy">
          {dropLabel} <span className="text-brand-green">{browseLabel}</span>
        </span>
        <span className="text-sm text-brand-muted">{typesLabel}</span>
        <input
          id={props.id}
          type="file"
          accept={props.accept}
          aria-required={props.required || undefined}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={props.error ? errorId : undefined}
          onChange={(e) => {
            pick(e.target.files, props)
            e.target.value = ""
          }}
          className="sr-only"
        />
      </label>
      <FieldError id={errorId} message={props.error} />
    </div>
  )
}

/** The compact PSA card upload (Figma 550:622). */
export function FileButton({
  placeholder,
  typesLabel,
  ...props
}: Props & { placeholder: string; typesLabel: string }) {
  const errorId = `${props.id}-error`
  return (
    <div
      className="flex min-w-0 flex-col gap-2"
      data-invalid={props.error ? "" : undefined}
    >
      <Label htmlFor={props.id} required={props.required}>
        {props.label}
      </Label>
      {props.file ? (
        <Chosen
          file={props.file}
          removeLabel={props.removeLabel}
          onRemove={() => props.onChange(null)}
        />
      ) : (
        <label
          className={cn(
            "flex h-[52px] cursor-pointer items-center gap-2.5 rounded-xl border-2 border-dashed px-[18px] focus-within:ring-3 focus-within:ring-brand-blue/20",
            props.error
              ? "border-red-600"
              : "border-brand-green/50 bg-brand-mint/40 hover:border-brand-green"
          )}
        >
          <Upload aria-hidden className="size-[18px] text-brand-green" />
          <span className="flex-1 truncate text-[15px] font-bold text-brand-green-dark">
            {placeholder}
          </span>
          <span className="text-[13px] text-brand-muted">{typesLabel}</span>
          <input
            id={props.id}
            type="file"
            accept={props.accept}
            aria-invalid={props.error ? true : undefined}
            aria-describedby={props.error ? errorId : undefined}
            onChange={(e) => {
              pick(e.target.files, props)
              e.target.value = ""
            }}
            className="sr-only"
          />
        </label>
      )}
      <FieldError id={errorId} message={props.error} />
    </div>
  )
}
