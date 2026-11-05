"use client"

import { ArrowRight, CircleCheck, Info, Lock } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { useTurnstile } from "@/components/home/use-turnstile"
import { buttonClassName } from "@/components/ui/button"
import {
  APPLICATIONS_ENDPOINT,
  applicationAnswers,
  PSA_HELD,
  ROLE_CLOSED_CODE,
} from "@/lib/schemas/api/applications"
import { cn } from "@/lib/utils"
import type { CareersTemplate } from "@/templates/careers/schema"

import { CheckboxCards } from "./checkbox-cards"
import { FieldError, SelectField, TextAreaField, TextField } from "./fields"
import { FileButton, FileDrop } from "./file-drop"
import { emptyPeriod, HistoryPeriods, type Period } from "./history-periods"
import { RadioCards } from "./radio-cards"
import { FormSection } from "./section"

type Copy = CareersTemplate["apply"]
type Psa = (typeof PSA_HELD)[number]

type State = {
  firstName: string
  surname: string
  email: string
  phone: string
  address: string
  town: string
  eircode: string
  rightToWork: string | null
  permissionExpiry: string
  psa: Psa | null
  psaNumber: string
  psaCategory: string
  psaExpiry: string
  qualifications: string[]
  history: Period[]
  gardaVetting: boolean | null
  livedAbroad: boolean | null
  experience: string
  startDate: string
  shifts: string[]
  transport: boolean | null
  coverNote: string
  heardFrom: string
  consents: [boolean, boolean, boolean]
}

const initialState = (): State => ({
  firstName: "",
  surname: "",
  email: "",
  phone: "",
  address: "",
  town: "",
  eircode: "",
  rightToWork: null,
  permissionExpiry: "",
  psa: null,
  psaNumber: "",
  psaCategory: "",
  psaExpiry: "",
  qualifications: [],
  history: [emptyPeriod()],
  gardaVetting: null,
  livedAbroad: null,
  experience: "",
  startDate: "",
  shifts: [],
  transport: null,
  coverNote: "",
  heardFrom: "",
  consents: [false, false, false],
})

/** What the API receives: no form-only keys; PSA details only with a licence. */
function answersOf(s: State) {
  const licensed = s.psa === "valid"
  return {
    ...s,
    rightToWork: s.rightToWork ?? "",
    psa: s.psa ?? undefined,
    psaNumber: licensed ? s.psaNumber : "",
    psaCategory: licensed ? s.psaCategory : "",
    psaExpiry: licensed ? s.psaExpiry : "",
    gardaVetting: s.gardaVetting ?? undefined,
    livedAbroad: s.livedAbroad ?? undefined,
    transport: s.transport ?? undefined,
    history: s.history.map((p) => ({
      employer: p.employer,
      role: p.role,
      from: p.from,
      to: p.to,
      reason: p.reason,
    })),
  }
}

type Errors = Record<string, string>

function omit(errors: Errors, key: string): Errors {
  if (!(key in errors)) return errors
  const next = { ...errors }
  delete next[key]
  return next
}

const CV_ACCEPT =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const PSA_ACCEPT = ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"

export type ApplicationFormProps = {
  copy: Copy
  jobSlug: string
  /** Shared site messages (Settings ▸ Contact section). */
  messages: { errorMessage: string; rateLimitedMessage: string }
}

/**
 * The application form (Figma 550:285). Checked here with the API's own
 * schema, then sent as multipart with one submission token per mounted
 * form: a double click or a retry stores one application.
 */
export function ApplicationForm({
  copy,
  jobSlug,
  messages,
}: ApplicationFormProps) {
  const f = copy.fields
  const o = copy.options
  const h = copy.hints
  const [state, setState] = useState(initialState)
  const [cv, setCv] = useState<File | null>(null)
  const [psaCard, setPsaCard] = useState<File | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [focusRequest, setFocusRequest] = useState(0)
  const [submissionId] = useState(() => crypto.randomUUID())
  const inFlight = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const turnstileSlot = useRef<HTMLDivElement>(null)
  const turnstile = useTurnstile(turnstileSlot)
  const successRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (focusRequest === 0) return
    const first = formRef.current?.querySelector<HTMLElement>("[data-invalid]")
    const target = first?.matches("input, select, textarea")
      ? first
      : first?.querySelector<HTMLElement>("input, select, textarea")
    target?.focus()
  }, [focusRequest])

  useEffect(() => {
    if (sent) successRef.current?.focus()
  }, [sent])

  const set = <K extends keyof State>(key: K, value: State[K]) => {
    setState((s) => ({ ...s, [key]: value }))
    setErrors((e) => omit(e, key))
  }

  const message = (text: string, value: unknown) =>
    text === "Required" || value === "" || value === undefined
      ? h.required
      : text.startsWith("Required")
        ? h.required
        : h.invalid

  function validate(): Errors {
    const answers = answersOf(state)
    const result = applicationAnswers.safeParse(answers)
    const out: Errors = {}
    if (!result.success)
      for (const issue of result.error.issues) {
        const key = issue.path.map(String).join(".")
        if (key in out) continue
        const value = issue.path.reduce<unknown>(
          (v, p) => (v as Record<PropertyKey, unknown> | undefined)?.[p],
          answers
        )
        out[key] = message(issue.message, value)
      }
    if (!cv) out.cv ??= errors.cv ?? h.required
    if (errors.psaCard) out.psaCard = errors.psaCard
    return out
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const found = validate()
    setBanner(null)
    if (Object.keys(found).length > 0) {
      setErrors(found)
      setFocusRequest((n) => n + 1)
      return
    }
    inFlight.current = true
    setSending(true)
    try {
      const token = await turnstile.getToken()
      const body = new FormData()
      body.set("jobSlug", jobSlug)
      body.set("submissionId", submissionId)
      body.set("answers", JSON.stringify(answersOf(state)))
      body.set("cv", cv!)
      if (psaCard) body.set("psaCard", psaCard)
      const website = formRef.current?.querySelector<HTMLInputElement>(
        "input[name=website]"
      )?.value
      if (website) body.set("website", website)
      if (token) body.set("turnstileToken", token)
      const res = await fetch(APPLICATIONS_ENDPOINT, { method: "POST", body })
      if (res.ok) {
        setSent(true)
        return
      }
      if (res.status === 429) {
        setBanner(messages.rateLimitedMessage)
        return
      }
      const payload = (await res.json().catch(() => null)) as {
        error?: { code?: string; fieldErrors?: Record<string, string[]> }
      } | null
      const fieldErrors = payload?.error?.fieldErrors
      if (fieldErrors && Object.keys(fieldErrors).length > 0) {
        const mapped: Errors = {}
        for (const [key, list] of Object.entries(fieldErrors)) {
          const name = key.replace(/^answers\./, "")
          mapped[name] =
            name === "cv" || name === "psaCard"
              ? list[0]
              : message(list[0], "x")
        }
        setErrors(mapped)
        setFocusRequest((n) => n + 1)
      } else if (payload?.error?.code === ROLE_CLOSED_CODE) {
        setBanner(copy.closedNotice)
      } else {
        setBanner(messages.errorMessage)
      }
    } catch {
      setBanner(messages.errorMessage)
    } finally {
      inFlight.current = false
      setSending(false)
      turnstile.reset()
    }
  }

  if (sent)
    return (
      <div className="flex flex-col items-center gap-4 px-2 py-10 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-brand-mint text-brand-green">
          <CircleCheck aria-hidden className="size-8" />
        </span>
        <h2
          ref={successRef}
          tabIndex={-1}
          className="text-[28px] leading-[1.2] font-black text-brand-navy outline-none"
        >
          {copy.successTitle}
        </h2>
        <p
          role="status"
          className="max-w-[520px] text-base leading-[1.6] text-brand-ink"
        >
          {copy.successText}
        </p>
      </div>
    )

  const sections = copy.sections
  const yesNo = [
    { value: "yes" as const, label: o.yes },
    { value: "no" as const, label: o.no },
  ]
  const yn = (v: boolean | null) => (v === null ? null : v ? "yes" : "no")
  const licensed = state.psa !== "applied" && state.psa !== "no"

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit}
      onFocus={() => void turnstile.prepare()}
      className="relative flex flex-col gap-9"
    >
      <FormSection number={1} {...sections[0]}>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="firstName"
            label={f.firstName.label}
            placeholder={f.firstName.placeholder}
            required
            autoComplete="given-name"
            value={state.firstName}
            onChange={(v) => set("firstName", v)}
            error={errors.firstName}
          />
          <TextField
            id="surname"
            label={f.surname.label}
            placeholder={f.surname.placeholder}
            required
            autoComplete="family-name"
            value={state.surname}
            onChange={(v) => set("surname", v)}
            error={errors.surname}
          />
          <TextField
            id="email"
            type="email"
            label={f.email.label}
            placeholder={f.email.placeholder}
            required
            autoComplete="email"
            value={state.email}
            onChange={(v) => set("email", v)}
            error={errors.email}
          />
          <TextField
            id="phone"
            type="tel"
            label={f.phone.label}
            placeholder={f.phone.placeholder}
            required
            autoComplete="tel"
            value={state.phone}
            onChange={(v) => set("phone", v)}
            error={errors.phone}
          />
          <TextField
            id="address"
            className="sm:col-span-2"
            label={f.address.label}
            placeholder={f.address.placeholder}
            autoComplete="street-address"
            value={state.address}
            onChange={(v) => set("address", v)}
            error={errors.address}
          />
          <TextField
            id="town"
            label={f.town.label}
            placeholder={f.town.placeholder}
            required
            autoComplete="address-level2"
            value={state.town}
            onChange={(v) => set("town", v)}
            error={errors.town}
          />
          <TextField
            id="eircode"
            label={f.eircode.label}
            placeholder={f.eircode.placeholder}
            autoComplete="postal-code"
            value={state.eircode}
            onChange={(v) => set("eircode", v)}
            error={errors.eircode}
          />
        </div>
      </FormSection>

      <FormSection number={2} {...sections[1]}>
        <RadioCards
          id="rightToWork"
          label={f.rightToWork.label}
          required
          hint={h.rightToWork}
          options={o.rightToWork.map((label) => ({ value: label, label }))}
          value={state.rightToWork}
          onChange={(v) => set("rightToWork", v)}
          error={errors.rightToWork}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="permissionExpiry"
            type="date"
            label={f.permissionExpiry.label}
            value={state.permissionExpiry}
            onChange={(v) => set("permissionExpiry", v)}
            error={errors.permissionExpiry}
          />
        </div>
      </FormSection>

      <FormSection number={3} {...sections[2]}>
        <RadioCards
          id="psa"
          cols={3}
          label={f.psaHeld.label}
          required
          options={PSA_HELD.map((value, i) => ({ value, label: o.psaHeld[i] }))}
          value={state.psa}
          onChange={(v) => set("psa", v)}
          error={errors.psa}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          {licensed && (
            <>
              <TextField
                id="psaNumber"
                label={f.psaNumber.label}
                placeholder={f.psaNumber.placeholder}
                required
                value={state.psaNumber}
                onChange={(v) => set("psaNumber", v)}
                error={errors.psaNumber}
              />
              <SelectField
                id="psaCategory"
                label={f.psaCategory.label}
                placeholder={f.psaCategory.placeholder}
                required
                options={o.psaCategory}
                value={state.psaCategory}
                onChange={(v) => set("psaCategory", v)}
                error={errors.psaCategory}
              />
              <TextField
                id="psaExpiry"
                type="date"
                label={f.psaExpiry.label}
                required
                value={state.psaExpiry}
                onChange={(v) => set("psaExpiry", v)}
                error={errors.psaExpiry}
              />
            </>
          )}
          <FileButton
            id="psaCard"
            label={f.psaCard.label}
            placeholder={f.psaCard.placeholder}
            typesLabel={h.psaCardTypes}
            accept={PSA_ACCEPT}
            file={psaCard}
            error={errors.psaCard}
            removeLabel={h.removeFile}
            tooLargeMessage={h.fileTooLarge}
            onChange={(file, error) => {
              setPsaCard(file)
              setErrors((e) =>
                error ? { ...e, psaCard: error } : omit(e, "psaCard")
              )
            }}
          />
        </div>
        <CheckboxCards
          id="qualifications"
          label={f.qualifications.label}
          options={o.qualifications}
          value={state.qualifications}
          onChange={(v) => set("qualifications", v)}
          error={errors.qualifications}
        />
      </FormSection>

      <FormSection number={4} {...sections[3]}>
        <HistoryPeriods
          copy={copy}
          periods={state.history}
          errors={errors}
          onChange={(history) => setState((s) => ({ ...s, history }))}
        />
        <FieldError id="history-error" message={errors.history} />
        <RadioCards
          id="gardaVetting"
          label={f.gardaVetting.label}
          required
          options={yesNo}
          value={yn(state.gardaVetting)}
          onChange={(v) => set("gardaVetting", v === "yes")}
          error={errors.gardaVetting}
        />
        <RadioCards
          id="livedAbroad"
          label={f.livedAbroad.label}
          required
          hint={h.livedAbroad}
          options={yesNo}
          value={yn(state.livedAbroad)}
          onChange={(v) => set("livedAbroad", v === "yes")}
          error={errors.livedAbroad}
        />
      </FormSection>

      <FormSection number={5} {...sections[4]}>
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            id="experience"
            label={f.experience.label}
            placeholder={f.experience.placeholder}
            required
            options={o.experience}
            value={state.experience}
            onChange={(v) => set("experience", v)}
            error={errors.experience}
          />
          <TextField
            id="startDate"
            type="date"
            label={f.startDate.label}
            required
            value={state.startDate}
            onChange={(v) => set("startDate", v)}
            error={errors.startDate}
          />
        </div>
        <CheckboxCards
          id="shifts"
          label={f.shifts.label}
          required
          options={o.shifts}
          value={state.shifts}
          onChange={(v) => set("shifts", v)}
          error={errors.shifts}
        />
        <RadioCards
          id="transport"
          label={f.transport.label}
          required
          options={yesNo}
          value={yn(state.transport)}
          onChange={(v) => set("transport", v === "yes")}
          error={errors.transport}
        />
      </FormSection>

      <FormSection number={6} {...sections[5]}>
        <FileDrop
          id="cv"
          label={f.cv.label}
          required
          dropLabel={h.cvDrop}
          browseLabel={h.cvBrowse}
          typesLabel={h.cvTypes}
          accept={CV_ACCEPT}
          file={cv}
          error={errors.cv}
          removeLabel={h.removeFile}
          tooLargeMessage={h.fileTooLarge}
          onChange={(file, error) => {
            setCv(file)
            setErrors((e) => (error ? { ...e, cv: error } : omit(e, "cv")))
          }}
        />
        <TextAreaField
          id="coverNote"
          label={f.coverNote.label}
          placeholder={f.coverNote.placeholder}
          value={state.coverNote}
          onChange={(v) => set("coverNote", v)}
          error={errors.coverNote}
        />
        <SelectField
          id="heardFrom"
          label={f.heardFrom.label}
          placeholder={f.heardFrom.placeholder}
          options={o.heardFrom}
          value={state.heardFrom}
          onChange={(v) => set("heardFrom", v)}
          error={errors.heardFrom}
        />
      </FormSection>

      <FormSection number={7} {...sections[6]}>
        <div className="flex flex-col gap-4">
          {copy.consents.map((text, i) => {
            const key = `consents.${i}`
            const error = errors[key]
            return (
              <div
                key={key}
                data-invalid={error ? "" : undefined}
                className="flex flex-col gap-1.5"
              >
                <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-normal text-brand-ink">
                  <input
                    type="checkbox"
                    checked={state.consents[i]}
                    aria-required={i < 2 || undefined}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `consent-${i}-error` : undefined}
                    onChange={(e) => {
                      const next = [...state.consents] as State["consents"]
                      next[i] = e.target.checked
                      setState((s) => ({ ...s, consents: next }))
                      setErrors((e) => omit(e, key))
                    }}
                    className="mt-0.5 size-5 shrink-0 accent-brand-green"
                  />
                  <span>{text}</span>
                </label>
                <FieldError id={`consent-${i}-error`} message={error} />
              </div>
            )
          })}
        </div>
        <p className="flex items-start gap-3 rounded-xl border border-brand-blue/20 bg-brand-blue/5 px-4 py-3.5 text-sm leading-normal text-brand-ink">
          <Info aria-hidden className="mt-px size-5 shrink-0 text-brand-blue" />
          <span>{copy.equalOpportunity}</span>
        </p>
      </FormSection>

      <div className="flex flex-col items-center gap-3">
        <p
          role="alert"
          className={cn(
            banner
              ? "w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[15px] font-bold text-red-800"
              : "sr-only"
          )}
        >
          {banner ?? ""}
        </p>
        <button
          type="submit"
          disabled={sending}
          className={buttonClassName(
            { variant: "brand", size: "pill" },
            "w-full gap-2.5"
          )}
        >
          {sending ? copy.sendingLabel : copy.submitLabel}
          {!sending && <ArrowRight aria-hidden className="size-[18px]" />}
        </button>
        <p className="flex items-center gap-2 text-sm text-brand-muted">
          <Lock aria-hidden className="size-3.5" />
          {copy.secureNote}
        </p>
      </div>

      {/* Honeypot: invisible to people and assistive tech, filled by bots. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 -left-[10000px] h-px w-px overflow-hidden opacity-0"
      >
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <div ref={turnstileSlot} className="absolute h-0 w-0 overflow-hidden" />
    </form>
  )
}
