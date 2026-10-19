"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CircleAlert,
  KeyRound,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react"
import { type FormEvent, useEffect, useState } from "react"
import { toast } from "sonner"

import { UnsavedGuard } from "@/components/admin/editor/unsaved-guard"
import {
  ADMIN_CONTROL,
  ADMIN_TEXTAREA,
  FormCard,
  FormSubsection,
} from "@/components/admin/form/form-ui"
import {
  NO_PASSWORD_MANAGER,
  secretStateText,
  TestResult,
} from "@/components/admin/integrations/integration-fields"
import { CONFLICT_MESSAGE } from "@/components/admin/integrations/integration-form"
import { ROLE_NAMES } from "@/components/admin/integrations/integration-meta"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { CardSkeleton } from "@/components/admin/kit/skeletons"
import { StatusPill } from "@/components/admin/kit/status-pill"
import { FORM_ACTION, PageHeader } from "@/components/admin/page-header"
import {
  describedBy,
  ErrorText,
  FieldShell,
  HelpText,
  LABEL_CLASS,
} from "@/components/admin/schema-form/widgets/field-shell"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { usePermission } from "@/hooks/use-permission"
import { normaliseBaseUrl } from "@/lib/ai/base-url"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import type { Role } from "@/lib/auth/roles"
import type {
  IntegrationDto,
  IntegrationTestResult,
} from "@/lib/schemas/api/integrations"
import {
  AI_DEFAULT_MODEL,
  AI_EXTRA_INSTRUCTIONS_MAX,
  AI_OUTPUT_TOKEN_LIMITS,
  AI_PROVIDERS,
  AI_ROLES,
  type AiProvider,
} from "@/lib/schemas/integrations/ai"
import { cn } from "@/lib/utils"

import { AI_STATUS_KEY } from "./queries"

const KEY = "integrations.ai"
const QUERY_KEY = ["integrations", KEY] as const
const ID = "ai-settings"
const id = (name: string) => `${ID}-${name}`
/** The model suggestions (`<datalist>`) "List models" fills. */
const MODELS_LIST_ID = "ai-models"

const PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: "Anthropic Claude",
  openai: "OpenAI",
  google: "Google Gemini",
  "openai-compatible": "OpenAI-compatible",
}

/** Roles that always have the assistant: shown ticked and fixed. */
const ALWAYS: readonly Role[] = ["owner", "admin"]

const SHARE_ACK =
  "I confirm that sending enquirers' names, topics and messages to the AI provider has been approved for this site. I understand that conversations may then contain enquiry details."

const SAVE_FIRST = "Save first"

/** Same look as the integration forms: focus stays on unavailable buttons. */
const SOFT_DISABLED =
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:active:translate-y-0"

const CHOICE_ROW =
  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm transition-colors hover:bg-muted/60 has-data-checked:bg-primary/5"

type KeyMode = "keep" | "replace" | "remove"

type Form = {
  enabled: boolean
  provider: AiProvider
  model: string
  baseUrl: string
  allowedRoles: Role[]
  extraInstructions: string
  maxOutputTokens: number | null
  share: boolean
}

/** The form for a saved state; owner and admin are always allowed. */
function formOf(dto: IntegrationDto): Form {
  const v = dto.values
  const provider = AI_PROVIDERS.includes(v.provider as AiProvider)
    ? (v.provider as AiProvider)
    : "anthropic"
  const saved = Array.isArray(v.allowedRoles) ? (v.allowedRoles as Role[]) : []
  return {
    enabled: v.enabled === true,
    provider,
    model: typeof v.model === "string" ? v.model : "",
    baseUrl: typeof v.baseUrl === "string" ? v.baseUrl : "",
    allowedRoles: AI_ROLES.filter(
      (role) => ALWAYS.includes(role) || saved.includes(role)
    ),
    extraInstructions:
      typeof v.extraInstructions === "string" ? v.extraInstructions : "",
    maxOutputTokens:
      typeof v.maxOutputTokens === "number"
        ? v.maxOutputTokens
        : AI_OUTPUT_TOKEN_LIMITS.default,
    share:
      (v.shareEnquiryDetails as { enabled?: unknown } | undefined)?.enabled ===
      true,
  }
}

/** Form fields in order: where a server error is shown and focused. */
const FIELD_ORDER = [
  "enabled",
  "provider",
  "baseUrl",
  "apiKey",
  "model",
  "allowedRoles",
  "shareEnquiryDetails",
  "extraInstructions",
  "maxOutputTokens",
] as const
type FieldName = (typeof FIELD_ORDER)[number]
type Errors = Partial<Record<FieldName, string>>

/** The element a field's error moves focus to. */
const FOCUS_TARGET: Record<FieldName, string> = {
  enabled: id("enabled"),
  provider: id("provider"),
  baseUrl: id("base-url"),
  apiKey: id("api-key"),
  model: id("model"),
  allowedRoles: id("roles"),
  shareEnquiryDetails: id("share"),
  extraInstructions: id("instructions"),
  maxOutputTokens: id("max-tokens"),
}

/**
 * Site settings ▸ AI assistant (MK parity §6.3): a form over the
 * `integrations.ai` record. Saves immediately; the API key is write-only
 * (Keep / Replace / Remove); "Test connection" uses the saved settings.
 */
export function AiSettingsView() {
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      unwrap(
        api.integrations[":key"].$get({ param: { key: KEY } })
      ) as Promise<IntegrationDto>,
  })

  const header = (
    <PageHeader
      title="AI assistant"
      description="Choose the provider and who can use the assistant."
      actions={
        query.data ? (
          <StatusPill
            tone={
              !query.data.configured
                ? "neutral"
                : query.data.values.enabled === true
                  ? "success"
                  : "neutral"
            }
          >
            {!query.data.configured
              ? "Not set up"
              : query.data.values.enabled === true
                ? "On"
                : "Off"}
          </StatusPill>
        ) : null
      }
    />
  )

  if (query.isPending)
    return (
      <div>
        {header}
        <div role="status">
          <p className="sr-only">Loading settings…</p>
          <CardSkeleton className="h-96" />
        </div>
      </div>
    )
  if (query.isError)
    return (
      <div>
        {header}
        <EmptyState
          role="alert"
          icon={CircleAlert}
          title="These settings could not be loaded"
          description={errorMessage(query.error)}
          action={
            <Button
              type="button"
              variant="outline"
              className={FORM_ACTION}
              onClick={() => query.refetch()}
            >
              Try again
            </Button>
          }
        />
      </div>
    )
  return (
    <div>
      {header}
      {/* A new saved state (save, their version) starts the form over. */}
      <SettingsForm
        key={`${query.data.version}:${query.data.updatedAt ?? ""}`}
        dto={query.data}
      />
    </div>
  )
}

function SettingsForm({ dto }: { dto: IntegrationDto }) {
  const queryClient = useQueryClient()
  const canEdit = usePermission({ integration: ["update"] })
  const canTest = usePermission({ integration: ["test"] })
  // The enquiry-details switch is the owner's alone (ruling 5).
  const isOwner = usePermission({ owner: ["manage"] })
  const saved = formOf(dto)
  const [form, setForm] = useState<Form>(saved)
  const hasKey = dto.secrets.apiKey?.set === true
  const [keyMode, setKeyMode] = useState<KeyMode>("keep")
  const [newKey, setNewKey] = useState("")
  const [acknowledge, setAcknowledge] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [focusField, setFocusField] = useState<{ name: FieldName } | null>(null)
  const [outcome, setOutcome] = useState<{
    ok: boolean
    message: string
  } | null>(null)

  // A typed key never outlives the screen.
  useEffect(() => () => setNewKey(""), [])

  useEffect(() => {
    if (!focusField) return
    const element = document.getElementById(FOCUS_TARGET[focusField.name])
    // Groups carry the id: focus their first control.
    const target =
      element?.tagName === "FIELDSET" ||
      element?.getAttribute("role") === "radiogroup"
        ? element.querySelector<HTMLElement>(
            '[role="radio"]:not([aria-disabled="true"]), [role="checkbox"]:not([aria-disabled="true"]), [role="switch"]'
          )
        : element
    target?.focus()
  }, [focusField])

  const compatible = form.provider === "openai-compatible"
  // A new provider or base URL never inherits the saved key (C6 server rule).
  const keyFollows =
    form.provider === saved.provider &&
    (!compatible ||
      normaliseBaseUrl(form.baseUrl) === normaliseBaseUrl(saved.baseUrl))
  const showKeyChoice = hasKey && keyFollows
  const showKeyInput = !showKeyChoice || keyMode === "replace"
  const typedKey = showKeyInput ? newKey.trim() : ""
  const removeKey = showKeyChoice && keyMode === "remove"
  const losesKey = hasKey && !keyFollows && typedKey === ""
  const shareChanged = isOwner && form.share !== saved.share

  const dirty =
    JSON.stringify(form) !== JSON.stringify(saved) ||
    typedKey !== "" ||
    removeKey
  const set = <K extends keyof Form>(name: K, value: Form[K]) =>
    setForm((prev) => ({ ...prev, [name]: value }))

  const takeTheirs = (err: unknown): boolean => {
    if (!(err instanceof ApiError && err.isConflict && err.current))
      return false
    queryClient.setQueryData(QUERY_KEY, err.current)
    toast.error("Not saved", {
      id: "integration-conflict",
      description: CONFLICT_MESSAGE,
    })
    return true
  }

  const showFieldErrors = (fieldErrors: Record<string, string[]>) => {
    const byField: Errors = {}
    const rest: string[] = []
    for (const [path, messages] of Object.entries(fieldErrors)) {
      const name = path.split(".")[0] as FieldName
      if (FIELD_ORDER.includes(name)) byField[name] ??= messages[0]
      else rest.push(...messages)
    }
    setErrors(byField)
    const first = FIELD_ORDER.find((name) => byField[name])
    if (first) setFocusField({ name: first })
    return { first, rest }
  }

  const save = useMutation({
    mutationFn: () => {
      const values: Record<string, unknown> = {
        enabled: form.enabled,
        provider: form.provider,
        model: form.model.trim(),
        baseUrl: compatible ? form.baseUrl.trim() : "",
        allowedRoles: form.allowedRoles,
        extraInstructions: form.extraInstructions,
        maxOutputTokens: form.maxOutputTokens,
      }
      if (typedKey) values.apiKey = typedKey
      if (shareChanged)
        values.shareEnquiryDetails = form.share
          ? { enabled: true, acknowledge }
          : { enabled: false }
      return unwrap(
        api.integrations[":key"].$put({
          param: { key: KEY },
          json: {
            version: dto.version,
            values,
            ...(removeKey ? { clearSecrets: ["apiKey"] } : {}),
          },
        })
      ) as Promise<IntegrationDto>
    },
    onSuccess: (next) => {
      queryClient.setQueryData(QUERY_KEY, next)
      void queryClient.invalidateQueries({ queryKey: ["integrations", "list"] })
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      // The topbar button and panel follow the assistant's state.
      void queryClient.invalidateQueries({ queryKey: AI_STATUS_KEY })
      toast.success("Saved")
    },
    onError: (err) => {
      if (takeTheirs(err)) return
      if (err instanceof ApiError && err.status === 422) {
        const { first, rest } = showFieldErrors(err.fieldErrors)
        if (rest.length > 0 || !first) setFormError(rest[0] ?? err.message)
        return
      }
      toast.error("Not saved", { description: errorMessage(err) })
    },
  })

  const test = useMutation({
    mutationFn: () =>
      unwrap(
        api.integrations[":key"].test.$post({ param: { key: KEY } })
      ) as Promise<IntegrationTestResult>,
    onMutate: () => setOutcome(null),
    onSuccess: (result) =>
      setOutcome({ ok: result.ok === true, message: String(result.message) }),
    onError: (err) => {
      setOutcome({ ok: false, message: errorMessage(err) })
      if (err instanceof ApiError) showFieldErrors(err.fieldErrors)
    },
  })

  const listModels = useMutation({
    mutationFn: () =>
      unwrap(
        api.ai.models.$post({
          json: {
            provider: form.provider,
            baseUrl: compatible ? form.baseUrl.trim() : "",
          },
        })
      ) as Promise<{ models: string[] }>,
    onSuccess: (result) => {
      setModels(result.models)
      toast.success(
        result.models.length === 1
          ? "1 model found"
          : `${result.models.length} models found`
      )
    },
    onError: (err) =>
      toast.error("Models not listed", { description: errorMessage(err) }),
  })

  const busy = save.isPending
  const canSave = canEdit && dirty && !busy
  const needsSave = dirty || !dto.configured
  const canRunTest = !needsSave && !busy && !test.isPending

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!canSave) return
    setErrors({})
    setFormError(null)
    save.mutate()
  }

  const chooseProvider = (provider: AiProvider) => {
    setForm((prev) => ({
      ...prev,
      provider,
      // Model IDs differ per provider: back to the saved one, or a start.
      model:
        provider === saved.provider
          ? saved.model
          : provider === "anthropic"
            ? AI_DEFAULT_MODEL
            : "",
    }))
    setModels([])
  }

  const error = (name: FieldName) => errors[name]
  const invalid = (name: FieldName) => (errors[name] ? true : undefined)

  return (
    <div className="flex flex-col gap-6">
      <UnsavedGuard when={dirty} />
      <FormCard
        id={ID}
        title="Settings"
        description={
          canEdit
            ? "The API key is stored encrypted and never shown again."
            : "Only owners and administrators can change these settings."
        }
        className="max-w-3xl"
      >
        <form
          onSubmit={onSubmit}
          noValidate
          autoComplete="off"
          className="flex flex-col gap-6"
        >
          <fieldset disabled={!canEdit} className="contents">
            <FormSubsection id={id("provider-section")} title="Provider">
              {/* Enabled */}
              <div
                data-invalid={invalid("enabled")}
                className="flex min-h-16 items-center justify-between gap-4 rounded-xl border bg-background px-4 py-3 shadow-xs"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <label htmlFor={id("enabled")} className={LABEL_CLASS}>
                    Turn on the AI assistant
                  </label>
                  <HelpText id={`${id("enabled")}-help`}>
                    It suggests text and answers questions; it never changes the
                    site.
                  </HelpText>
                  {error("enabled") ? (
                    <ErrorText id={`${id("enabled")}-error`}>
                      {error("enabled")}
                    </ErrorText>
                  ) : null}
                </div>
                <Switch
                  id={id("enabled")}
                  checked={form.enabled}
                  disabled={!canEdit}
                  aria-invalid={invalid("enabled")}
                  aria-describedby={describedBy(id("enabled"), {
                    help: "y",
                    error: error("enabled"),
                  })}
                  onCheckedChange={(checked) => set("enabled", checked)}
                />
              </div>

              {/* Provider */}
              <div className="flex flex-col gap-2">
                <span id={`${id("provider")}-label`} className={LABEL_CLASS}>
                  Provider
                </span>
                <RadioGroup
                  id={id("provider")}
                  aria-labelledby={`${id("provider")}-label`}
                  aria-describedby={
                    error("provider") ? `${id("provider")}-error` : undefined
                  }
                  value={form.provider}
                  disabled={!canEdit}
                  onValueChange={(value) => chooseProvider(value as AiProvider)}
                  className="flex flex-wrap gap-x-2 gap-y-1"
                >
                  {AI_PROVIDERS.map((provider) => (
                    <label key={provider} className={CHOICE_ROW}>
                      <RadioGroupItem value={provider} />
                      {PROVIDER_LABELS[provider]}
                    </label>
                  ))}
                </RadioGroup>
                {error("provider") ? (
                  <ErrorText id={`${id("provider")}-error`}>
                    {error("provider")}
                  </ErrorText>
                ) : null}
              </div>

              {/* Base URL: OpenAI-compatible only */}
              {compatible ? (
                <FieldShell
                  id={id("base-url")}
                  label="Base URL"
                  help="The address that ends before /chat/completions, e.g. Groq, OpenRouter, Mistral or Together. https only."
                  error={error("baseUrl")}
                >
                  <Input
                    id={id("base-url")}
                    type="url"
                    inputMode="url"
                    spellCheck={false}
                    placeholder="https://api.groq.com/openai/v1"
                    className={ADMIN_CONTROL}
                    value={form.baseUrl}
                    aria-invalid={invalid("baseUrl")}
                    aria-describedby={describedBy(id("base-url"), {
                      help: "y",
                      error: error("baseUrl"),
                    })}
                    onChange={(e) => set("baseUrl", e.target.value)}
                  />
                </FieldShell>
              ) : null}

              {/* API key: Keep / Replace / Remove */}
              <ApiKeyField
                hasKey={hasKey}
                hint={secretStateText(dto.secrets.apiKey)}
                showChoice={showKeyChoice}
                showInput={showKeyInput}
                mode={keyMode}
                onMode={(mode) => {
                  setKeyMode(mode)
                  if (mode !== "replace") setNewKey("")
                }}
                value={newKey}
                onValue={setNewKey}
                losesKey={losesKey}
                error={error("apiKey")}
                disabled={!canEdit}
              />

              {/* Model + List models */}
              <FieldShell
                id={id("model")}
                label="Model"
                help="The model ID from the provider. List models shows what the saved key can use."
                error={error("model")}
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id={id("model")}
                    list={MODELS_LIST_ID}
                    spellCheck={false}
                    autoComplete="off"
                    className={cn(ADMIN_CONTROL, "sm:flex-1")}
                    value={form.model}
                    aria-invalid={invalid("model")}
                    aria-describedby={describedBy(id("model"), {
                      help: "y",
                      error: error("model"),
                    })}
                    onChange={(e) => set("model", e.target.value)}
                  />
                  {canEdit ? (
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(FORM_ACTION, "bg-card", SOFT_DISABLED)}
                      aria-disabled={listModels.isPending || undefined}
                      onClick={() => {
                        if (!listModels.isPending) listModels.mutate()
                      }}
                    >
                      {listModels.isPending ? (
                        <LoaderCircle
                          aria-hidden
                          className="size-4 animate-spin motion-reduce:animate-none"
                        />
                      ) : null}
                      List models
                    </Button>
                  ) : null}
                </div>
                <datalist id={MODELS_LIST_ID}>
                  {models.map((model) => (
                    <option key={model} value={model} />
                  ))}
                </datalist>
              </FieldShell>
            </FormSubsection>

            <FormSubsection id={id("access-section")} title="Access">
              {/* Who can use it */}
              <fieldset
                id={id("roles")}
                className="flex flex-col gap-1"
                aria-describedby={describedBy(id("roles"), {
                  help: "y",
                  error: error("allowedRoles"),
                })}
              >
                <legend className={cn(LABEL_CLASS, "mb-0.5")}>
                  Who can use it
                </legend>
                <HelpText id={`${id("roles")}-help`}>
                  Owners and admins can always use it.
                </HelpText>
                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
                  {AI_ROLES.map((role) => {
                    const fixed = ALWAYS.includes(role)
                    return (
                      <label
                        key={role}
                        className={cn(
                          CHOICE_ROW,
                          (fixed || !canEdit) &&
                            "cursor-default hover:bg-transparent"
                        )}
                      >
                        <Checkbox
                          checked={fixed || form.allowedRoles.includes(role)}
                          disabled={fixed || !canEdit}
                          aria-invalid={invalid("allowedRoles")}
                          onCheckedChange={(checked) =>
                            set(
                              "allowedRoles",
                              AI_ROLES.filter((r) =>
                                r === role
                                  ? checked
                                  : form.allowedRoles.includes(r)
                              )
                            )
                          }
                        />
                        {ROLE_NAMES[role]}
                      </label>
                    )
                  })}
                </div>
                {error("allowedRoles") ? (
                  <ErrorText id={`${id("roles")}-error`}>
                    {error("allowedRoles")}
                  </ErrorText>
                ) : null}
              </fieldset>

              {/* Enquiry details: owners only */}
              {isOwner ? (
                <fieldset
                  className="flex flex-col gap-3 rounded-xl border bg-background px-4 py-3 shadow-xs"
                  data-invalid={invalid("shareEnquiryDetails")}
                >
                  <legend className="sr-only">Enquiry details</legend>
                  <div className="flex min-h-10 items-center justify-between gap-4">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <label htmlFor={id("share")} className={LABEL_CLASS}>
                        Let the assistant read enquiry details
                      </label>
                      <HelpText id={`${id("share")}-help`}>
                        Off by default. When on, people who can read enquiries
                        may get names, topics and messages in answers.
                      </HelpText>
                    </div>
                    <Switch
                      id={id("share")}
                      checked={form.share}
                      disabled={!canEdit}
                      aria-invalid={invalid("shareEnquiryDetails")}
                      aria-describedby={describedBy(id("share"), {
                        help: "y",
                        error: error("shareEnquiryDetails"),
                      })}
                      onCheckedChange={(checked) => {
                        set("share", checked)
                        if (!checked) setAcknowledge(false)
                      }}
                    />
                  </div>
                  {form.share && !saved.share ? (
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 rounded-lg py-2 text-sm pointer-coarse:min-h-11",
                        !canEdit && "cursor-default"
                      )}
                    >
                      <Checkbox
                        className="mt-0.5"
                        checked={acknowledge}
                        disabled={!canEdit}
                        aria-invalid={invalid("shareEnquiryDetails")}
                        aria-describedby={
                          error("shareEnquiryDetails")
                            ? `${id("share")}-error`
                            : undefined
                        }
                        onCheckedChange={(checked) => setAcknowledge(checked)}
                      />
                      <span>{SHARE_ACK}</span>
                    </label>
                  ) : null}
                  {error("shareEnquiryDetails") ? (
                    <ErrorText id={`${id("share")}-error`}>
                      {error("shareEnquiryDetails")}
                    </ErrorText>
                  ) : null}
                </fieldset>
              ) : null}
            </FormSubsection>

            <FormSubsection id={id("answers-section")} title="Answers">
              <FieldShell
                id={id("instructions")}
                label="Extra instructions"
                help="Tone, words to avoid, how to refer to the company. Added after the built-in rules, which still apply."
                error={error("extraInstructions")}
                optional
                extra={
                  <p
                    id={`${id("instructions")}-count`}
                    className="text-xs text-muted-foreground tabular-nums"
                  >
                    {form.extraInstructions.length}/{AI_EXTRA_INSTRUCTIONS_MAX}
                  </p>
                }
              >
                <Textarea
                  id={id("instructions")}
                  rows={4}
                  maxLength={AI_EXTRA_INSTRUCTIONS_MAX}
                  className={ADMIN_TEXTAREA}
                  value={form.extraInstructions}
                  aria-invalid={invalid("extraInstructions")}
                  aria-describedby={describedBy(id("instructions"), {
                    help: "y",
                    error: error("extraInstructions"),
                    extraId: `${id("instructions")}-count`,
                  })}
                  onChange={(e) => set("extraInstructions", e.target.value)}
                />
              </FieldShell>
              <FieldShell
                id={id("max-tokens")}
                label="Longest answer (tokens)"
                help={`${AI_OUTPUT_TOKEN_LIMITS.min}–${AI_OUTPUT_TOKEN_LIMITS.max}. About 750 words per 1,000 tokens.`}
                error={error("maxOutputTokens")}
              >
                <Input
                  id={id("max-tokens")}
                  type="number"
                  inputMode="numeric"
                  step={1}
                  min={AI_OUTPUT_TOKEN_LIMITS.min}
                  max={AI_OUTPUT_TOKEN_LIMITS.max}
                  className={cn(ADMIN_CONTROL, "w-36")}
                  value={form.maxOutputTokens ?? ""}
                  aria-invalid={invalid("maxOutputTokens")}
                  aria-describedby={describedBy(id("max-tokens"), {
                    help: "y",
                    error: error("maxOutputTokens"),
                  })}
                  onChange={(e) =>
                    set(
                      "maxOutputTokens",
                      e.target.value === "" ? null : Number(e.target.value)
                    )
                  }
                />
              </FieldShell>
            </FormSubsection>
          </fieldset>

          {formError ? (
            <p
              role="alert"
              className="flex items-start gap-2 text-sm text-destructive"
            >
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {formError}
            </p>
          ) : null}

          {canEdit || canTest ? (
            <div className="flex flex-col border-t pt-5">
              <div className="flex flex-wrap items-center gap-3">
                {canEdit ? (
                  <Button
                    type="submit"
                    className={cn(FORM_ACTION, SOFT_DISABLED)}
                    aria-disabled={!canSave || undefined}
                  >
                    {save.isPending ? "Saving…" : "Save"}
                  </Button>
                ) : null}
                {canTest ? (
                  <Tooltip disabled={!needsSave}>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(FORM_ACTION, "bg-card", SOFT_DISABLED)}
                          aria-disabled={!canRunTest || undefined}
                          aria-describedby={
                            needsSave ? id("save-first") : undefined
                          }
                          onClick={() => {
                            if (!canRunTest) return
                            setErrors({})
                            test.mutate()
                          }}
                        />
                      }
                    >
                      Test connection
                    </TooltipTrigger>
                    <TooltipContent>{SAVE_FIRST}</TooltipContent>
                  </Tooltip>
                ) : null}
                {needsSave && canTest ? (
                  <span id={id("save-first")} className="sr-only">
                    {SAVE_FIRST}
                  </span>
                ) : null}
              </div>
              {canTest ? (
                <TestResult pending={test.isPending} outcome={outcome} />
              ) : null}
            </div>
          ) : null}
        </form>
      </FormCard>
    </div>
  )
}

function ApiKeyField({
  hasKey,
  hint,
  showChoice,
  showInput,
  mode,
  onMode,
  value,
  onValue,
  losesKey,
  error,
  disabled,
}: {
  hasKey: boolean
  hint: string
  showChoice: boolean
  showInput: boolean
  mode: KeyMode
  onMode: (mode: KeyMode) => void
  value: string
  onValue: (value: string) => void
  losesKey: boolean
  error: string | undefined
  disabled: boolean
}) {
  const inputId = id("api-key")
  const hintId = `${inputId}-saved`
  const warningId = `${inputId}-warning`
  const input = showInput ? (
    <Input
      id={inputId}
      type="password"
      autoComplete="new-password"
      spellCheck={false}
      {...NO_PASSWORD_MANAGER}
      className={ADMIN_CONTROL}
      value={value}
      aria-invalid={error ? true : undefined}
      aria-describedby={
        [
          showChoice ? null : hintId,
          losesKey ? warningId : null,
          error ? `${inputId}-error` : null,
        ]
          .filter(Boolean)
          .join(" ") || undefined
      }
      onChange={(e) => onValue(e.target.value)}
    />
  ) : null
  const saved = (
    <p
      id={hintId}
      className="flex items-center gap-1.5 text-xs text-muted-foreground"
    >
      <KeyRound aria-hidden className="size-3.5 shrink-0" />
      <span>{hasKey ? hint : "Not saved yet"}</span>
    </p>
  )
  const warning = losesKey ? (
    <p
      id={warningId}
      className="bg-warning-soft text-warning flex items-start gap-2 rounded-xl px-3 py-2 text-sm"
    >
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>
        Changing the provider or base URL removes the saved key. Enter a key for
        the new provider, or the assistant will not work.
      </span>
    </p>
  ) : null
  const errorText = error ? (
    <ErrorText id={`${inputId}-error`}>{error}</ErrorText>
  ) : null

  if (!showChoice)
    return (
      <div
        className="flex flex-col gap-2"
        data-invalid={error ? true : undefined}
      >
        <label htmlFor={inputId} className={LABEL_CLASS}>
          {hasKey ? "New API key" : "API key"}
        </label>
        {saved}
        {input}
        {warning}
        {errorText}
      </div>
    )

  return (
    <div
      className="flex flex-col gap-2"
      data-invalid={error ? true : undefined}
    >
      <span id={`${inputId}-label`} className={LABEL_CLASS}>
        API key
      </span>
      {saved}
      <RadioGroup
        aria-labelledby={`${inputId}-label`}
        aria-describedby={hintId}
        value={mode}
        disabled={disabled}
        onValueChange={(next) => onMode(next as KeyMode)}
        className="flex flex-wrap gap-x-2 gap-y-1"
      >
        <label className={CHOICE_ROW}>
          <RadioGroupItem value="keep" />
          Keep the saved key
        </label>
        <label className={CHOICE_ROW}>
          <RadioGroupItem value="replace" />
          Replace it
        </label>
        <label className={CHOICE_ROW}>
          <RadioGroupItem value="remove" />
          Remove it
        </label>
      </RadioGroup>
      {showInput ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={inputId} className={LABEL_CLASS}>
            New API key
          </label>
          {input}
        </div>
      ) : null}
      {mode === "remove" ? (
        <HelpText id={`${inputId}-remove`}>
          The saved key is deleted when you save. Turn the assistant off first,
          or it cannot answer.
        </HelpText>
      ) : null}
      {errorText}
    </div>
  )
}
