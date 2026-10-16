"use client"

import { useQuery } from "@tanstack/react-query"
import { ImageIcon, Link2 } from "lucide-react"
import { useState } from "react"
import { get, useController, useFormState } from "react-hook-form"

import { MediaPickerDialog } from "@/components/admin/media/picker-dialog"
import { useMediaItem } from "@/components/admin/media/use-media-item"
import { RichTextEditor } from "@/components/admin/rich-text/editor"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import type { OptionCollection, OptionItem } from "@/lib/schemas/api/search"

import { fieldId, useSchemaForm, type WidgetProps } from "../context"
import { NativeSelect } from "./basic"
import {
  deepErrorText,
  describedBy,
  errorText,
  FieldShell,
} from "./field-shell"

function useOptions(collection: OptionCollection | undefined, enabled = true) {
  return useQuery({
    queryKey: ["options", collection],
    queryFn: () =>
      unwrap(
        api.search.options[":collection"].$get({
          param: { collection: collection! },
        })
      ),
    enabled: !!collection && enabled,
    staleTime: 60_000,
  })
}

const grouped = (items: OptionItem[]) =>
  items.reduce<Record<string, OptionItem[]>>((acc, item) => {
    ;(acc[item.group] ??= []).push(item)
    return acc
  }, {})

/** Label + destination; "Pick" lists internal pages, services and articles. */
export function LinkWidget({ field, path }: WidgetProps) {
  const { idPrefix, disabled } = useSchemaForm()
  const {
    field: {
      name: labelName,
      value: labelValue,
      onChange: onLabelChange,
      onBlur: onLabelBlur,
      ref: labelRef,
    },
    fieldState: labelState,
  } = useController({ name: `${path}.label` })
  const {
    field: {
      name: hrefName,
      value: hrefValue,
      onChange: onHrefChange,
      onBlur: onHrefBlur,
      ref: hrefRef,
    },
    fieldState: hrefState,
  } = useController({ name: `${path}.href` })
  const [open, setOpen] = useState(false)
  const options = useOptions("links", open)
  const id = fieldId(idPrefix, path)
  const labelError = errorText(labelState.error)
  const hrefError = errorText(hrefState.error)
  // An error on the link as a whole (e.g. a server message for "hero.cta").
  const { errors } = useFormState({ name: path, exact: true })
  const ownError = errorText(get(errors, path))
  return (
    <fieldset
      className="flex flex-col gap-3 rounded-lg border p-3"
      aria-describedby={describedBy(id, {
        help: field.meta.help,
        error: ownError,
      })}
    >
      <legend className="px-1 text-sm font-semibold">{field.label}</legend>
      {field.meta.help ? (
        <p id={`${id}-help`} className="-mt-1 text-sm text-muted-foreground">
          {field.meta.help}
        </p>
      ) : null}
      {ownError ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {ownError}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldShell id={`${id}-label`} label="Text" error={labelError}>
          <Input
            id={`${id}-label`}
            name={labelName}
            ref={labelRef}
            value={(labelValue as string) ?? ""}
            disabled={disabled}
            aria-invalid={!!labelError}
            aria-describedby={describedBy(`${id}-label`, { error: labelError })}
            onChange={(event) => onLabelChange(event.target.value)}
            onBlur={onLabelBlur}
          />
        </FieldShell>
        <FieldShell id={`${id}-href`} label="Link to" error={hrefError}>
          <div className="flex gap-2">
            <Input
              id={`${id}-href`}
              name={hrefName}
              ref={hrefRef}
              value={(hrefValue as string) ?? ""}
              placeholder="/contact, https://…, tel:…"
              disabled={disabled}
              aria-invalid={!!hrefError}
              aria-describedby={describedBy(`${id}-href`, { error: hrefError })}
              onChange={(event) => onHrefChange(event.target.value)}
              onBlur={onHrefBlur}
            />
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    disabled={disabled}
                    aria-label={`Pick a page for ${field.label}`}
                  />
                }
              >
                <Link2 aria-hidden />
                <span className="max-sm:sr-only">Pick</span>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <Command label="Pages on this site">
                  <CommandInput placeholder="Find a page…" />
                  <CommandList>
                    <CommandEmpty>
                      {options.isPending
                        ? "Loading…"
                        : options.isError
                          ? errorMessage(options.error)
                          : "No pages found."}
                    </CommandEmpty>
                    {Object.entries(grouped(options.data?.items ?? [])).map(
                      ([group, items]) => (
                        <CommandGroup key={group} heading={group}>
                          {items.map((item) => (
                            <CommandItem
                              key={item.value}
                              value={`${item.label} ${item.value}`}
                              onSelect={() => {
                                onHrefChange(item.value)
                                setOpen(false)
                              }}
                            >
                              <span className="truncate">{item.label}</span>
                              <span className="ml-auto truncate text-xs text-muted-foreground">
                                {item.value}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </FieldShell>
      </div>
    </fieldset>
  )
}

/** One record from a collection (meta.collection), stored as slug/id. */
export function CollectionWidget({ field, path }: WidgetProps) {
  const { idPrefix, disabled } = useSchemaForm()
  const { field: f, fieldState } = useController({ name: path })
  const options = useOptions(field.meta.collection)
  const id = fieldId(idPrefix, path)
  const error =
    errorText(fieldState.error) ??
    (options.isError ? errorMessage(options.error) : undefined)
  const help = field.meta.help
  const value = (f.value as string | null | undefined) ?? ""
  const items = options.data?.items ?? []
  return (
    <FieldShell
      id={id}
      label={field.label}
      help={help}
      error={error}
      optional={field.optional || field.nullable}
    >
      <NativeSelect
        id={id}
        value={value}
        disabled={disabled || options.isPending}
        invalid={!!error}
        describedBy={describedBy(id, { help, error })}
        selectRef={f.ref}
        onChange={(next) => f.onChange(next === "" ? null : next)}
        onBlur={f.onBlur}
      >
        <option value="">{options.isPending ? "Loading…" : "— None —"}</option>
        {value && !items.some((i) => i.value === value) ? (
          <option value={value}>{value}</option>
        ) : null}
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </NativeSelect>
    </FieldShell>
  )
}

/** Library image: thumbnail, "Choose…" (picker dialog) and "Remove" when optional. */
export function MediaWidget({ field, path }: WidgetProps) {
  const { idPrefix, disabled } = useSchemaForm()
  const {
    field: { value, onChange, ref },
    fieldState,
  } = useController({ name: path })
  const [open, setOpen] = useState(false)
  const chosen = value as { mediaId: string } | null | undefined
  const item = useMediaItem(chosen?.mediaId)
  const id = fieldId(idPrefix, path)
  const error = fieldState.error
    ? chosen
      ? deepErrorText(fieldState.error)
      : "Choose an image"
    : undefined
  const help = field.meta.help
  const action = chosen ? "Change image" : "Choose image"
  return (
    <FieldShell
      id={id}
      label={field.label}
      help={help}
      error={error}
      optional={field.optional || field.nullable}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:16px_16px]">
          {item.data ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
            <img
              src={item.data.url}
              alt={item.data.alt}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <ImageIcon aria-hidden className="size-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="truncate text-sm text-muted-foreground">
            {chosen
              ? item.data
                ? item.data.alt || item.data.url
                : item.isError
                  ? "Image not found"
                  : "Loading…"
              : "No image chosen"}
          </p>
          <div className="flex gap-2">
            <Button
              id={id}
              ref={ref}
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              // Starts with the visible text (WCAG 2.5.3 label in name).
              aria-label={`${action}: ${field.label}`}
              aria-invalid={!!error}
              aria-describedby={describedBy(id, { help, error })}
              onClick={() => setOpen(true)}
            >
              {action}
            </Button>
            {chosen && (field.nullable || field.optional) ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                aria-label={`Remove: ${field.label}`}
                onClick={() => onChange(null)}
              >
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <MediaPickerDialog
        open={open}
        onOpenChange={setOpen}
        selectedId={chosen?.mediaId}
        title={`Choose: ${field.label}`}
        onSelect={(picked) => onChange({ mediaId: picked.id })}
      />
    </FieldShell>
  )
}

export function RichTextWidget({ field, path }: WidgetProps) {
  const { idPrefix, disabled } = useSchemaForm()
  const { field: f, fieldState } = useController({ name: path })
  const id = fieldId(idPrefix, path)
  const error =
    deepErrorText(fieldState.error) ??
    (fieldState.error ? "Check the formatting of this text" : undefined)
  const help = field.meta.help
  return (
    <FieldShell
      id={id}
      label={field.label}
      help={help}
      error={error}
      optional={field.optional || field.nullable}
    >
      <RichTextEditor
        id={id}
        label={field.label}
        mode={field.richTextMode}
        value={
          (f.value as Parameters<typeof RichTextEditor>[0]["value"]) ?? null
        }
        onChange={(doc) => f.onChange(doc)}
        describedBy={describedBy(id, { help, error })}
        invalid={!!error}
        disabled={disabled}
      />
    </FieldShell>
  )
}
