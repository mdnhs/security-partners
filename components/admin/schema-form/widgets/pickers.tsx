"use client"

import { useQuery } from "@tanstack/react-query"
import { ImageIcon, Link2 } from "lucide-react"
import { useState } from "react"
import { useController } from "react-hook-form"

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
import { describedBy, errorText, FieldShell } from "./field-shell"

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
  const label = useController({ name: `${path}.label` })
  const href = useController({ name: `${path}.href` })
  const [open, setOpen] = useState(false)
  const options = useOptions("links", open)
  const id = fieldId(idPrefix, path)
  const labelError = errorText(label.fieldState.error)
  const hrefError = errorText(href.fieldState.error)
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-semibold">{field.label}</legend>
      {field.meta.help ? (
        <p className="-mt-1 text-sm text-muted-foreground">{field.meta.help}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldShell id={`${id}-label`} label="Text" error={labelError}>
          <Input
            id={`${id}-label`}
            value={(label.field.value as string) ?? ""}
            disabled={disabled}
            aria-invalid={!!labelError}
            aria-describedby={describedBy(`${id}-label`, { error: labelError })}
            onChange={(event) => label.field.onChange(event.target.value)}
            onBlur={label.field.onBlur}
          />
        </FieldShell>
        <FieldShell id={`${id}-href`} label="Link to" error={hrefError}>
          <div className="flex gap-2">
            <Input
              id={`${id}-href`}
              value={(href.field.value as string) ?? ""}
              placeholder="/contact, https://…, tel:…"
              disabled={disabled}
              aria-invalid={!!hrefError}
              aria-describedby={describedBy(`${id}-href`, { error: hrefError })}
              onChange={(event) => href.field.onChange(event.target.value)}
              onBlur={href.field.onBlur}
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
                                href.field.onChange(item.value)
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
  const { field: f, fieldState } = useController({ name: path })
  const [open, setOpen] = useState(false)
  const ref = f.value as { mediaId: string } | null | undefined
  const item = useMediaItem(ref?.mediaId)
  const id = fieldId(idPrefix, path)
  const error = fieldState.error
    ? ref
      ? errorText(fieldState.error)
      : "Choose an image"
    : undefined
  const help = field.meta.help
  return (
    <FieldShell
      id={id}
      label={field.label}
      help={help}
      error={error}
      optional={field.optional || field.nullable}
    >
      <div
        id={id}
        tabIndex={-1}
        className="flex flex-wrap items-center gap-3 outline-none"
      >
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
            {ref
              ? item.data
                ? item.data.alt || item.data.url
                : item.isError
                  ? "Image not found"
                  : "Loading…"
              : "No image chosen"}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              aria-label={`${ref ? "Change" : "Choose"}: ${field.label}`}
              aria-describedby={describedBy(id, { help, error })}
              onClick={() => setOpen(true)}
            >
              {ref ? "Change image" : "Choose image"}
            </Button>
            {ref && (field.nullable || field.optional) ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                aria-label={`Remove: ${field.label}`}
                onClick={() => f.onChange(null)}
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
        selectedId={ref?.mediaId}
        title={`Choose: ${field.label}`}
        onSelect={(chosen) => f.onChange({ mediaId: chosen.id })}
      />
    </FieldShell>
  )
}

export function RichTextWidget({ field, path }: WidgetProps) {
  const { idPrefix, disabled } = useSchemaForm()
  const { field: f, fieldState } = useController({ name: path })
  const id = fieldId(idPrefix, path)
  const error =
    errorText(fieldState.error) ??
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
