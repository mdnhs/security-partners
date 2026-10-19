"use client"

import { useQuery } from "@tanstack/react-query"
import type { JSONContent } from "@tiptap/react"
import { ImageIcon, Link2, ListTree } from "lucide-react"
import dynamic from "next/dynamic"
import { useState } from "react"
import { get, useController, useFormState } from "react-hook-form"

import { MediaPickerDialog } from "@/components/admin/media/picker-dialog"
import { useMediaItem } from "@/components/admin/media/use-media-item"
import { ADMIN_CONTROL } from "@/components/admin/form/form-ui"
import { Skeleton } from "@/components/ui/skeleton"
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
import { cn } from "@/lib/utils"
import type { OptionCollection, OptionItem } from "@/lib/schemas/api/search"

import { fieldId, useSchemaForm, type WidgetProps } from "../context"
import { OptionSelect } from "@/components/admin/option-select"
import {
  deepErrorText,
  describedBy,
  ErrorText,
  errorText,
  FieldShell,
  HelpText,
} from "./field-shell"

/** What a link destination points at, shown under it (null: say nothing). */
export function destinationKind(href: string): string | null {
  const value = href.trim()
  if (!value) return null
  if (value.startsWith("{")) return "Filled in from Contact details."
  if (value.startsWith("#")) return "A section of the same page."
  if (value.startsWith("/")) return "A page on this site."
  if (value.startsWith("tel:")) return "Starts a phone call."
  if (value.startsWith("mailto:")) return "Opens an email."
  if (/^https?:\/\//.test(value)) return "Another website."
  return null
}

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
  const inItem = /\.\d+$/.test(path)
  // Its two inputs are required only when the link itself is.
  const linkRequired = !(field.optional || field.nullable) || undefined
  const kind = destinationKind((hrefValue as string | null) ?? "")
  const kindId = `${id}-href-kind`
  return (
    <fieldset
      className={cn(
        "flex min-w-0 flex-col gap-4",
        !inItem && "rounded-xl border bg-muted/30 p-4"
      )}
      aria-describedby={describedBy(id, {
        help: field.meta.help,
        error: ownError,
      })}
    >
      {/* A list item's card already shows its name ("Link 2"). */}
      <legend
        className={cn(
          "float-left mb-1 w-full text-sm font-semibold",
          inItem && "sr-only"
        )}
      >
        {field.label}
        {/* An optional link is marked on its legend; its inputs are not required. */}
        {linkRequired ? null : (
          <>
            {" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </>
        )}
      </legend>
      {field.meta.help ? (
        <div className="-mt-3">
          <HelpText id={`${id}-help`}>{field.meta.help}</HelpText>
        </div>
      ) : null}
      {ownError ? <ErrorText id={`${id}-error`}>{ownError}</ErrorText> : null}
      <div className="grid gap-4 @lg/card:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <FieldShell id={`${id}-label`} label="Text" error={labelError}>
          <Input
            id={`${id}-label`}
            name={labelName}
            ref={labelRef}
            className={ADMIN_CONTROL}
            value={(labelValue as string) ?? ""}
            disabled={disabled}
            aria-required={linkRequired}
            aria-invalid={!!labelError}
            aria-describedby={describedBy(`${id}-label`, { error: labelError })}
            onChange={(event) => onLabelChange(event.target.value)}
            onBlur={onLabelBlur}
          />
        </FieldShell>
        <FieldShell
          id={`${id}-href`}
          label="Link to"
          error={hrefError}
          extra={
            kind && !hrefError ? (
              <p id={kindId} className="text-xs text-muted-foreground">
                {kind}
              </p>
            ) : null
          }
        >
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Link2
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id={`${id}-href`}
                name={hrefName}
                ref={hrefRef}
                className={cn(ADMIN_CONTROL, "pl-9")}
                value={(hrefValue as string) ?? ""}
                placeholder="/contact, https://…, tel:…"
                disabled={disabled}
                aria-required={linkRequired}
                aria-invalid={!!hrefError}
                aria-describedby={describedBy(`${id}-href`, {
                  error: hrefError,
                  extraId: kind && !hrefError ? kindId : undefined,
                })}
                onChange={(event) => onHrefChange(event.target.value)}
                onBlur={onHrefBlur}
              />
            </div>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-lg px-3"
                    disabled={disabled}
                    aria-label={`Pick a page for ${field.label}`}
                  />
                }
              >
                <ListTree aria-hidden />
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
      <OptionSelect
        id={id}
        value={value}
        options={[
          { value: "", label: options.isPending ? "Loading…" : "— None —" },
          // A stored slug the list no longer has stays visible (and chosen).
          ...(value &&
          !options.isPending &&
          !items.some((i) => i.value === value)
            ? [{ value, label: value }]
            : []),
          ...items,
        ]}
        disabled={disabled || options.isPending}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, { help, error })}
        triggerRef={f.ref}
        onChange={(next) => f.onChange(next === "" ? null : next)}
        onBlur={f.onBlur}
      />
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
      <div
        className={cn(
          "flex flex-col gap-4 rounded-xl border bg-background p-3 shadow-xs sm:flex-row sm:items-center",
          error && "border-destructive"
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:16px_16px]",
            field.meta.aspect === "square"
              ? "aspect-square w-24"
              : "aspect-video w-full sm:w-44"
          )}
        >
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
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-sm font-medium">
              {chosen
                ? item.data
                  ? fileName(item.data.url) || item.data.alt || "Image"
                  : item.isError
                    ? "Image not found"
                    : "Loading…"
                : "No image chosen"}
            </p>
            {item.data ? (
              <p className="truncate text-xs text-muted-foreground">
                {item.data.alt || "No description"}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              id={id}
              ref={ref}
              type="button"
              variant="outline"
              className="h-9 rounded-lg px-3 pointer-coarse:h-11"
              disabled={disabled}
              // Starts with the visible text (WCAG 2.5.3 label in name).
              aria-label={`${action}: ${field.label}`}
              aria-invalid={!!error}
              aria-describedby={describedBy(id, { help, error })}
              onClick={() => setOpen(true)}
            >
              <ImageIcon aria-hidden />
              {action}
            </Button>
            {chosen && (field.nullable || field.optional) ? (
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-lg px-3 text-destructive hover:text-destructive pointer-coarse:h-11"
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

/** "/media/2026/hero-banner.jpg" → "hero-banner.jpg". */
export function fileName(url: string | undefined): string {
  if (!url) return ""
  const segment = url.split(/[?#]/)[0].split("/").pop() || url
  try {
    return decodeURIComponent(segment)
  } catch {
    // A malformed escape ("100%.jpg") is shown as it is.
    return segment
  }
}

/**
 * TipTap/ProseMirror (~460 KB) loads only where a form has a rich-text
 * field, not with every SchemaForm screen (final review M2). The editor
 * renders nothing on the server anyway (immediatelyRender: false).
 */
const RichTextEditor = dynamic(
  () =>
    import("@/components/admin/rich-text/editor").then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <Skeleton aria-hidden className="h-[11.5rem] w-full rounded-xl" />
    ),
  }
)

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
        value={(f.value as JSONContent | null | undefined) ?? null}
        onChange={(doc) => f.onChange(doc)}
        describedBy={describedBy(id, { help, error })}
        invalid={!!error}
        disabled={disabled}
      />
    </FieldShell>
  )
}
