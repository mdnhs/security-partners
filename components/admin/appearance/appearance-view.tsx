"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Eye, History, Send } from "lucide-react"
import { useCallback, useId, useState } from "react"
import { toast } from "sonner"

import { ConflictDialog } from "@/components/admin/editor/conflict-dialog"
import {
  LivePreviewToggle,
  useLivePreview,
} from "@/components/admin/editor/live-preview-toggle"
import { PreviewPane } from "@/components/admin/editor/preview-pane"
import { RevisionDrawer } from "@/components/admin/editor/revision-drawer"
import { FORM_ACTION, PageHeader } from "@/components/admin/page-header"
import { useAdminSession } from "@/components/admin/session-provider"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePermission } from "@/hooks/use-permission"
import type { SaveState } from "@/hooks/use-autosave"
import { ApiError, api, errorMessage, unwrap } from "@/lib/api-client"
import type { RevisionSummary } from "@/lib/schemas/api/content"
import { previewHref } from "@/lib/schemas/api/preview"
import type { ThemeDto, ThemeResetScope } from "@/lib/schemas/api/theme"
import { buildAdminTokens, presetAdminColours } from "@/lib/theme/admin"
import { formatOklch } from "@/lib/theme/color"
import { checkTheme, describeIssue, tokenLabel } from "@/lib/theme/checks"
import { PRESET_IDS, PRESETS, type PresetId } from "@/lib/theme/presets"
import {
  ADMIN_RADII,
  type AdminThemeConfig,
  type ThemeConfigValue,
} from "@/lib/theme/schema"
import { presetSiteTheme, resolveSiteTokens } from "@/lib/theme/site"
import { SITE_TOKENS, type SiteToken } from "@/lib/theme/tokens"
import { cn } from "@/lib/utils"

import { AdminPreview } from "./admin-preview"
import { BrandAssets } from "./brand-assets"
import { ColourField } from "./colour-field"
import { ContrastPanel } from "./contrast-panel"
import { PresetGallery } from "./preset-gallery"
import { ThemeHistory } from "./theme-history"
import { useAdminMode, useLiveAdmin } from "./use-live-admin"
import {
  THEME_QUERY_KEY,
  THEME_REVISIONS_KEY,
  useThemeAutosave,
} from "./use-theme-autosave"

export const PUBLISH_BLOCKED = "Publishing is blocked until every pair passes."
const CARD = "flex min-w-0 flex-col gap-5 rounded-xl border bg-card p-5"
const PREVIEW_HREF = previewHref("settings", "theme")
// Widened: the picks are values, not literals.
const RADII: readonly number[] = ADMIN_RADII

const loadTheme = () => unwrap(api.appearance.$get())

/** /admin/appearance (spec §6.2, MK §7): the site and admin themes. */
export function AppearanceView({
  autosaveDelay,
}: {
  /** Test-only: the debounce before a draft is saved. */
  autosaveDelay?: number
}) {
  const query = useQuery({
    queryKey: THEME_QUERY_KEY,
    queryFn: loadTheme,
    staleTime: 0,
  })
  // Remounts the editor on a record it did not make itself (their version).
  const [generation, setGeneration] = useState(0)
  if (query.isPending)
    return (
      <div role="status" className="flex flex-col gap-4">
        <span className="sr-only">Loading appearance…</span>
        <Skeleton className="bg-skeleton rounded-card h-20" />
        <Skeleton className="bg-skeleton rounded-card h-96" />
      </div>
    )
  if (query.isError)
    return (
      <div
        role="alert"
        className="rounded-card flex flex-col items-start gap-3 border bg-card p-6"
      >
        <p className="font-medium">Appearance could not be loaded.</p>
        <p className="text-sm text-muted-foreground">
          {errorMessage(query.error)}
        </p>
        <Button type="button" variant="outline" onClick={() => query.refetch()}>
          Try again
        </Button>
      </div>
    )
  return (
    <Editor
      key={generation}
      initial={query.data}
      delay={autosaveDelay}
      remount={() => setGeneration((g) => g + 1)}
    />
  )
}

function statusText(state: SaveState, hasDraft: boolean): string {
  switch (state) {
    case "saving":
      return "Saving…"
    case "unsaved":
    case "invalid":
      return "Unsaved changes"
    case "conflict":
      return "Changed by someone else"
    case "error":
      return "Couldn't save"
    default:
      return hasDraft ? "Draft saved" : "No draft changes"
  }
}

type Pending = "publish" | "discard" | "reset" | "restore" | null

function Editor({
  initial,
  delay,
  remount,
}: {
  initial: ThemeDto
  delay?: number
  remount(): void
}) {
  const queryClient = useQueryClient()
  const canUpdate = usePermission({ appearance: ["update"] })
  const canPublish = usePermission({ appearance: ["publish"] })
  const { user } = useAdminSession()
  const theme = useThemeAutosave({ initial, enabled: canUpdate, delay })
  const { draft, record, run } = theme
  const { mode } = useAdminMode()
  // Only this page recolours the admin with the draft; leaving it hands
  // back to the published <style id="theme-tokens">.
  useLiveAdmin(draft.admin)

  const [tab, setTab] = useState("site")
  const [pending, setPending] = useState<Pending>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  // A publish the server refused (422): its reasons, until the next edit.
  const [serverErrors, setServerErrors] = useState<string[]>([])
  const [livePreview, setLivePreview] = useLivePreview(user.id)

  const update = (next: ThemeConfigValue) => {
    if (!canUpdate) return
    theme.setDraft(next)
    setServerErrors([])
  }

  const refreshHistory = () =>
    queryClient.invalidateQueries({ queryKey: THEME_REVISIONS_KEY })

  /** Runs an action; a 409 loads their version, a 422 shows its reasons. */
  const act = async (
    kind: Exclude<Pending, null>,
    call: (version: number) => Promise<ThemeDto>
  ): Promise<ThemeDto | null> => {
    setPending(kind)
    try {
      const dto = await run(call)
      setServerErrors([])
      return dto
    } catch (error) {
      if (error instanceof ApiError && error.isConflict) {
        const current = error.current as ThemeDto | undefined
        if (current && current !== theme.conflictDto) {
          // Someone saved meanwhile: show theirs (the dialog handles a
          // conflict from our own autosave).
          theme.replace(current)
          toast.error("Changed by someone else", {
            description: "Their version is loaded. Nothing was changed.",
          })
        }
        return null
      }
      if (error instanceof ApiError && error.status === 422) {
        const reasons = Object.values(error.fieldErrors).flat()
        setServerErrors(reasons.length ? reasons : [error.message])
        return null
      }
      toast.error(errorMessage(error))
      return null
    } finally {
      setPending(null)
    }
  }

  const publish = async () => {
    const dto = await act("publish", (version) =>
      unwrap(api.appearance.publish.$post({ json: { version } }))
    )
    setPublishOpen(false)
    if (!dto) return
    void refreshHistory()
    toast.success("Theme published", {
      description: "The site and the admin show the new colours now.",
    })
  }
  const discard = async () => {
    const dto = await act("discard", (version) =>
      unwrap(api.appearance.discard.$post({ json: { version } }))
    )
    setDiscardOpen(false)
    if (dto) toast.success("Draft discarded")
  }
  const reset = async (preset: PresetId, scope: ThemeResetScope) => {
    const dto = await act("reset", (version) =>
      unwrap(api.appearance.reset.$post({ json: { version, preset, scope } }))
    )
    if (dto) setResetOpen(false)
  }
  const restore = async (revision: RevisionSummary) => {
    const dto = await act("restore", (version) =>
      unwrap(
        api.appearance.restore.$post({
          json: { revisionId: revision.id, version },
        })
      )
    )
    if (dto)
      toast.success(`Version ${revision.version} loaded into the draft`, {
        description: "Publish it to make it live.",
      })
  }

  const previewOnSite = async () => {
    // Opened now (a click), pointed at the preview once pending edits are
    // saved: a window opened after an await is a blocked popup.
    const tab = window.open("", "_blank")
    if (tab) tab.opener = null
    await theme.flush()
    if (tab) tab.location.href = PREVIEW_HREF
    else window.open(PREVIEW_HREF, "_blank", "noopener")
  }

  const issues = checkTheme(draft)
  const busy = pending !== null
  const blocked = issues.length > 0 || serverErrors.length > 0
  const conflictDto = theme.conflictDto
  const readOnly = !canUpdate

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Appearance"
        description={
          <div className="flex flex-col gap-1">
            <p>
              Colours for the public site and the admin. Changes stay in a draft
              until you publish.
            </p>
            {canUpdate ? (
              <p
                role="status"
                aria-label="Save status"
                className="text-sm font-medium"
              >
                {statusText(theme.state, theme.hasDraft)}
              </p>
            ) : (
              <p className="text-sm font-medium">
                View only: your role cannot change the theme.
              </p>
            )}
          </div>
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className={FORM_ACTION}
              onClick={() => setHistoryOpen(true)}
            >
              <History aria-hidden />
              History
            </Button>
            <Button
              type="button"
              variant="outline"
              className={FORM_ACTION}
              onClick={() => void previewOnSite()}
            >
              <Eye aria-hidden />
              Preview on site
            </Button>
            {canUpdate ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className={FORM_ACTION}
                  disabled={busy || !theme.hasDraft}
                  onClick={() => setDiscardOpen(true)}
                >
                  Discard draft
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={FORM_ACTION}
                  disabled={busy}
                  onClick={() => setResetOpen(true)}
                >
                  Reset to preset…
                </Button>
              </>
            ) : null}
            {canPublish ? (
              <Button
                type="button"
                className={FORM_ACTION}
                disabled={
                  busy ||
                  issues.length > 0 ||
                  !theme.hasDraft ||
                  theme.state === "conflict"
                }
                onClick={() => setPublishOpen(true)}
              >
                <Send aria-hidden />
                Publish
              </Button>
            ) : null}
          </>
        }
      />

      {blocked ? (
        <div
          role="status"
          className="bg-danger-soft text-danger flex flex-col gap-1 rounded-xl p-4 text-sm"
        >
          <p className="font-semibold">{PUBLISH_BLOCKED}</p>
          {serverErrors.length ? (
            <ul className="list-disc pl-5">
              {serverErrors.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p>
              {describeIssue(issues[0]!)}
              {issues.length > 1 ? ` (and ${issues.length - 1} more)` : ""}
            </p>
          )}
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={(next) => setTab(String(next))}>
        <TabsList>
          <TabsTrigger value="site" className="pointer-coarse:min-h-11">
            Site
          </TabsTrigger>
          <TabsTrigger value="admin" className="pointer-coarse:min-h-11">
            Admin
          </TabsTrigger>
        </TabsList>
        <TabsContent value="site" className="pt-4">
          <div className="grid gap-5 xl:grid-cols-2">
            <fieldset
              disabled={readOnly}
              className="flex min-w-0 flex-col gap-5"
            >
              <SiteControls draft={draft} update={update} disabled={readOnly} />
              <ContrastPanel
                config={draft}
                scope="site"
                onFix={update}
                disabled={readOnly}
              />
            </fieldset>
            <section aria-labelledby="site-preview" className={CARD}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="site-preview" className="text-base font-semibold">
                  Site preview
                </h2>
                <LivePreviewToggle
                  checked={livePreview}
                  onCheckedChange={setLivePreview}
                />
              </div>
              {livePreview ? (
                <PreviewPane
                  src={PREVIEW_HREF}
                  refreshKey={record.version}
                  className="min-h-[28rem]"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Turn on Live preview to see the home page with the draft
                  colours here, or use Preview on site.
                </p>
              )}
            </section>
          </div>
        </TabsContent>
        <TabsContent value="admin" className="pt-4">
          <div className="grid gap-5 xl:grid-cols-2">
            <fieldset
              disabled={readOnly}
              className="flex min-w-0 flex-col gap-5"
            >
              <AdminControls
                draft={draft}
                update={update}
                disabled={readOnly}
              />
              <ContrastPanel
                config={draft}
                scope="admin"
                onFix={update}
                disabled={readOnly}
              />
            </fieldset>
            <div className="min-w-0">
              <AdminPreview mode={mode} />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="grid gap-5 xl:grid-cols-2">
        <BrandAssets />
        <ThemeHistory
          canRestore={canUpdate}
          busy={busy}
          onLoad={(revision) => void restore(revision)}
        />
      </div>

      <AlertDialog
        open={publishOpen}
        onOpenChange={(open) => !busy && setPublishOpen(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish the theme?</AlertDialogTitle>
            <AlertDialogDescription>
              The public site and the admin switch to the draft colours for
              everyone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={busy}
              onClick={() => void publish()}
            >
              {pending === "publish" ? (
                <Spinner data-icon="inline-start" />
              ) : null}
              Publish
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={discardOpen}
        onOpenChange={(open) => !busy && setDiscardOpen(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard the draft?</AlertDialogTitle>
            <AlertDialogDescription>
              The draft goes back to the live theme. Your unpublished changes
              are lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => void discard()}
            >
              Discard draft
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ResetDialog
        open={resetOpen}
        pending={pending === "reset"}
        onOpenChange={setResetOpen}
        onConfirm={(preset, scope) => void reset(preset, scope)}
      />

      <RevisionDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        entity="settings"
        entityId="theme"
        canRestore={canUpdate}
        onRestore={async (revision) => {
          await restore(revision)
        }}
      />

      <ConflictDialog
        open={theme.conflict !== null}
        updatedBy={null}
        updatedAt={conflictDto?.updatedAt ?? null}
        onReload={() => {
          theme.resolveConflict()
          if (conflictDto) theme.replace(conflictDto)
          else remount()
        }}
        onOverwrite={() => {
          if (!conflictDto) {
            toast.error("Their version could not be loaded", {
              description: "Copy yours, then reload the page.",
            })
            return
          }
          void theme.overwrite(conflictDto).then((saved) => {
            if (saved)
              toast.success("Your version replaced theirs", {
                description: "Publish to put it live.",
              })
          })
        }}
        onCopyMine={async () => {
          try {
            await navigator.clipboard.writeText(JSON.stringify(draft, null, 2))
            toast.success("Your version is on the clipboard")
          } catch {
            toast.error("Could not copy to the clipboard")
          }
          theme.resolveConflict()
          if (conflictDto) theme.replace(conflictDto)
          else remount()
        }}
      />
    </div>
  )
}

function SiteControls({
  draft,
  update,
  disabled,
}: {
  draft: ThemeConfigValue
  update(next: ThemeConfigValue): void
  disabled: boolean
}) {
  const { site } = draft
  const resolved = resolveSiteTokens(site)
  const setToken = (token: SiteToken, value: string | null) => {
    // A copy: never write into the stored (or a frozen) object.
    const tokens = { ...site.tokens }
    if (value) tokens[token] = value
    else delete tokens[token]
    update({ ...draft, site: { ...site, tokens } })
  }
  return (
    <section aria-labelledby="site-colours" className={CARD}>
      <h2 id="site-colours" className="text-base font-semibold">
        Site colours
      </h2>
      <PresetGallery
        scope="site"
        label="Preset"
        value={site.preset}
        disabled={disabled}
        onChange={(id) => update({ ...draft, site: presetSiteTheme(id) })}
      />
      <ColourField
        id="site-brand"
        label="Brand"
        description="Drives the green family: buttons, links and highlights."
        value={site.brand}
        fallback={formatOklch(resolved["brand-green"])}
        clearable
        disabled={disabled}
        onChange={(brand) => update({ ...draft, site: { ...site, brand } })}
      />
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
          Advanced tokens
        </summary>
        <p className="mb-4 text-xs text-muted-foreground">
          Lock a token to keep its colour when the brand changes.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {SITE_TOKENS.map((token) => {
            const locked = token in site.tokens
            return (
              <ColourField
                key={token}
                id={`site-${token}`}
                label={tokenLabel("site", token)}
                value={site.tokens[token] ?? null}
                fallback={formatOklch(resolved[token])}
                locked={locked}
                disabled={disabled}
                onChange={(value) => setToken(token, value)}
                onLockChange={(lock) =>
                  setToken(token, lock ? formatOklch(resolved[token]) : null)
                }
              />
            )
          })}
        </div>
      </details>
    </section>
  )
}

const TINTS = [
  ["preset", "Preset"],
  ["none", "None"],
  ["primary", "Primary"],
] as const
const MODES = [
  ["system", "System"],
  ["light", "Light"],
  ["dark", "Dark"],
] as const

function Choice<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string
  value: T
  options: readonly (readonly [T, string])[]
  disabled: boolean
  onChange(next: T): void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <p id={id} className="text-sm font-medium">
        {label}
      </p>
      <RadioGroup
        aria-labelledby={id}
        value={value}
        disabled={disabled}
        onValueChange={(next) => onChange(next as T)}
        className="flex flex-wrap gap-x-5 gap-y-1"
      >
        {options.map(([option, text]) => (
          <label
            key={option}
            className="flex min-h-9 items-center gap-2 text-sm pointer-coarse:min-h-11"
          >
            <RadioGroupItem value={option} /> {text}
          </label>
        ))}
      </RadioGroup>
    </div>
  )
}

function AdminControls({
  draft,
  update,
  disabled,
}: {
  draft: ThemeConfigValue
  update(next: ThemeConfigValue): void
  disabled: boolean
}) {
  const { admin } = draft
  const set = (patch: Partial<AdminThemeConfig>) =>
    update({ ...draft, admin: { ...admin, ...patch } })
  const tokens = buildAdminTokens(admin, "light")
  const nearest = RADII.reduce(
    (best, r, i) =>
      Math.abs(r - admin.radius) < Math.abs(RADII[best]! - admin.radius)
        ? i
        : best,
    0
  )
  const radiusId = useId()
  return (
    <section aria-labelledby="admin-colours" className={CARD}>
      <h2 id="admin-colours" className="text-base font-semibold">
        Admin colours
      </h2>
      <PresetGallery
        scope="admin"
        label="Preset"
        value={admin.preset}
        disabled={disabled}
        onChange={(id) => set(presetAdminColours(id))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <ColourField
          id="admin-primary"
          label="Primary"
          value={admin.primary}
          fallback={formatOklch(tokens.primary)}
          clearable
          disabled={disabled}
          onChange={(primary) => set({ primary })}
        />
        <ColourField
          id="admin-accent"
          label="Accent"
          value={admin.accent}
          fallback={formatOklch(tokens.accent)}
          clearable
          disabled={disabled}
          onChange={(accent) => set({ accent })}
        />
      </div>
      <Choice
        label="Neutral tint"
        value={admin.tint}
        options={TINTS}
        disabled={disabled}
        onChange={(tint) => set({ tint })}
      />
      <div className="flex flex-col gap-2">
        <label htmlFor={radiusId} className="text-sm font-medium">
          Corner radius
        </label>
        <div className="flex items-center gap-3">
          <input
            id={radiusId}
            type="range"
            min={0}
            max={RADII.length - 1}
            step={1}
            value={nearest}
            disabled={disabled}
            aria-valuetext={`${RADII[nearest]} rem`}
            onChange={(event) =>
              set({ radius: RADII[Number(event.target.value)]! })
            }
            className="h-11 w-full max-w-xs accent-primary disabled:opacity-60"
          />
          <output htmlFor={radiusId} className="text-sm tabular-nums">
            {RADII[nearest]}rem
          </output>
        </div>
      </div>
      <Choice
        label="Default mode"
        value={admin.mode}
        options={MODES}
        disabled={disabled}
        onChange={(mode) => set({ mode })}
      />
    </section>
  )
}

const PRESET_ITEMS = PRESET_IDS.map((id) => ({
  value: id,
  label: PRESETS[id].label,
}))
const SCOPES = [
  ["site", "Site"],
  ["admin", "Admin"],
  ["both", "Both"],
] as const

function ResetDialog({
  open,
  pending,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  pending: boolean
  onOpenChange(open: boolean): void
  onConfirm(preset: PresetId, scope: ThemeResetScope): void
}) {
  const [preset, setPreset] = useState<PresetId>("security-partners")
  const [scope, setScope] = useState<ThemeResetScope>("both")
  const presetId = useId()
  const close = useCallback(() => onOpenChange(false), [onOpenChange])
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset to preset</DialogTitle>
          <DialogDescription>
            Replaces the draft colours with a preset. Nothing goes live until
            you publish.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label htmlFor={presetId} className="text-sm font-medium">
            Preset
          </label>
          <Select
            items={PRESET_ITEMS}
            value={preset}
            onValueChange={(next) => next && setPreset(next as PresetId)}
          >
            <SelectTrigger id={presetId} className="w-full pointer-coarse:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESET_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Choice<ThemeResetScope>
          label="Scope"
          value={scope}
          options={SCOPES}
          disabled={pending}
          onChange={setScope}
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className={FORM_ACTION}
            disabled={pending}
            onClick={close}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className={cn(FORM_ACTION)}
            disabled={pending}
            onClick={() => onConfirm(preset, scope)}
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Reset draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
