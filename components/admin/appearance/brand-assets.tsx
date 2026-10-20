"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ImageIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

import { MediaPickerDialog } from "@/components/admin/media/picker-dialog"
import { useMediaItem } from "@/components/admin/media/use-media-item"
import { Button } from "@/components/ui/button"
import { usePermission } from "@/hooks/use-permission"
import { SETTINGS_ENTRIES } from "@/lib/admin/settings-keys"
import { ApiError, api, errorMessage, unwrap } from "@/lib/api-client"
import type { SiteSettings } from "@/lib/schemas/settings/site"

type MediaRef = { mediaId: string }
type Key = "logo" | "favicon"

const SITE_KEY = ["settings", "site"] as const
const param = { key: "site" } as const

/**
 * Logo and favicon (spec §6.2): they belong to the Identity settings
 * (`settings.site`), so a pick is saved into that draft and goes live when
 * Identity is published, not with the theme.
 */
export function BrandAssets() {
  const canRead = usePermission(SETTINGS_ENTRIES.site.read)
  const canUpdate = usePermission(SETTINGS_ENTRIES.site.update)
  const queryClient = useQueryClient()
  const site = useQuery({
    queryKey: SITE_KEY,
    queryFn: () => unwrap(api.settings[":key"].$get({ param })),
    enabled: canRead,
  })
  const save = useMutation({
    mutationFn: (patch: Partial<Record<Key, MediaRef | null>>) => {
      const current = site.data!
      return unwrap(
        api.settings[":key"].draft.$put({
          param,
          json: {
            version: current.version,
            draft: { ...(current.draft as SiteSettings), ...patch },
          },
        })
      )
    },
    onSuccess: (dto) => {
      queryClient.setQueryData(SITE_KEY, dto)
      toast.success("Saved to the Identity draft", {
        description: "Publish Identity to put it on the site.",
      })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.isConflict) {
        toast.error("Changed by someone else", {
          description: "Their version is loaded. Pick the image again.",
        })
        void queryClient.invalidateQueries({ queryKey: SITE_KEY })
        return
      }
      toast.error("Not saved", { description: errorMessage(error) })
    },
  })

  // Readers of the theme without settings:read (marketers) never see it.
  if (!canRead) return null
  const draft = site.data?.draft as SiteSettings | undefined
  const disabled = !canUpdate || save.isPending || !draft
  return (
    <section
      aria-labelledby="brand-assets"
      className="flex flex-col gap-4 rounded-xl border bg-card p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id="brand-assets" className="text-base font-semibold">
          Brand images
        </h2>
        <p className="text-sm text-muted-foreground">
          Saved to the{" "}
          <Link
            href="/admin/settings/site"
            className="font-medium text-primary underline underline-offset-3"
          >
            Identity
          </Link>{" "}
          draft. They go live when Identity is published.
        </p>
      </div>
      {site.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(site.error)}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <AssetRow
            label="Logo"
            value={draft?.logo ?? null}
            disabled={disabled}
            onChange={(logo) => logo && save.mutate({ logo })}
          />
          <AssetRow
            label="Favicon"
            help="Square PNG, at least 512 × 512."
            value={draft?.favicon ?? null}
            disabled={disabled}
            clearable
            onChange={(favicon) => save.mutate({ favicon })}
          />
        </div>
      )}
    </section>
  )
}

function AssetRow({
  label,
  help,
  value,
  disabled,
  clearable,
  onChange,
}: {
  label: string
  help?: string
  value: MediaRef | null
  disabled: boolean
  clearable?: boolean
  onChange(next: MediaRef | null): void
}) {
  const [open, setOpen] = useState(false)
  const item = useMediaItem(value?.mediaId)
  const action = value ? "Change image" : "Choose image"
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-background p-3">
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:16px_16px]">
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
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {value
            ? item.data
              ? item.data.alt || "No description"
              : item.isError
                ? "Image not found"
                : "Loading…"
            : "No image chosen"}
        </p>
        {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-lg px-3 pointer-coarse:h-11"
          disabled={disabled}
          aria-label={`${action}: ${label}`}
          onClick={() => setOpen(true)}
        >
          {action}
        </Button>
        {clearable && value ? (
          <Button
            type="button"
            variant="ghost"
            className="h-9 rounded-lg px-3 pointer-coarse:h-11"
            disabled={disabled}
            aria-label={`Remove: ${label}`}
            onClick={() => onChange(null)}
          >
            Remove
          </Button>
        ) : null}
      </div>
      <MediaPickerDialog
        open={open}
        onOpenChange={setOpen}
        selectedId={value?.mediaId ?? null}
        title={`Choose the ${label.toLowerCase()}`}
        onSelect={(picked) => {
          setOpen(false)
          onChange({ mediaId: picked.id })
        }}
      />
    </div>
  )
}
