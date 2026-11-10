"use client"

import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CircleCheck,
  Info,
  Lock,
  Mail,
  Phone,
  Send,
} from "lucide-react"
import Link from "next/link"
import { animate } from "motion"
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
import type { ApplyView } from "@/templates/careers/apply-view"
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

/** Phones: the form is a wizard, one section per step. */
const MINUTES_LEFT = [8, 7, 6, 4, 3, 2, 1]

function stepOfKey(key: string): number {
  if (
    [
      "firstName",
      "surname",
      "email",
      "phone",
      "address",
      "town",
      "eircode",
    ].includes(key)
  )
    return 0
  if (["rightToWork", "permissionExpiry"].includes(key)) return 1
  if (
    [
      "psa",
      "psaNumber",
      "psaCategory",
      "psaExpiry",
      "qualifications",
      "psaCard",
    ].includes(key)
  )
    return 2
  if (
    key.startsWith("history") ||
    key === "gardaVetting" ||
    key === "livedAbroad"
  )
    return 3
  if (["experience", "startDate", "shifts", "transport"].includes(key)) return 4
  if (["cv", "coverNote", "heardFrom"].includes(key)) return 5
  return 6
}

const CV_ACCEPT =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const PSA_ACCEPT = ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"

export type ApplicationFormProps = {
  copy: Copy
  jobSlug: string
  /** Shared site messages (Settings ▸ Contact section). */
  messages: { errorMessage: string; rateLimitedMessage: string }
  /** Phone wizard: where the header arrow leaves to, and the role being applied for. */
  backHref: string
  sidebar: ApplyView["sidebar"]
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
  backHref,
  sidebar,
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
  const [step, setStep] = useState(0)
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

  // Phones: the site chrome steps aside while filling in (globals.css).
  useEffect(() => {
    const root = document.documentElement
    root.dataset.applyFlow = sent ? "done" : "wizard"
    return () => {
      delete root.dataset.applyFlow
    }
  }, [sent])

  const total = copy.sections.length
  const previousStep = useRef(0)

  // Phones: the new step slides in from the side it was reached from.
  useEffect(() => {
    const from = previousStep.current
    previousStep.current = step
    if (from === step) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if (!window.matchMedia("(max-width: 767.98px)").matches) return
    const section = formRef.current?.querySelector<HTMLElement>(
      `[aria-labelledby="section-${step + 1}"]`
    )
    if (!section) return
    animate(
      section,
      { opacity: [0, 1], x: [step > from ? 28 : -28, 0] },
      { duration: 0.38, ease: [0.22, 1, 0.36, 1] }
    )
  }, [step])
  const goTo = (next: number) => {
    setStep(next)
    window.scrollTo({ top: 0 })
  }

  function goNext() {
    const found = validate()
    const mine: Errors = {}
    for (const [key, text] of Object.entries(found))
      if (stepOfKey(key) === step) mine[key] = text
    if (Object.keys(mine).length > 0) {
      setErrors((e) => ({ ...e, ...mine }))
      setFocusRequest((n) => n + 1)
      return
    }
    goTo(Math.min(step + 1, total - 1))
  }

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
      // Phones: jump to the first step with something to fix.
      setStep(Math.min(...Object.keys(found).map(stepOfKey)))
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
        setStep(Math.min(...Object.keys(mapped).map(stepOfKey)))
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
      <div className="flex flex-col items-center gap-4 px-5 py-10 text-center md:px-2">
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
        {/* Phones: what the sidebar shows on wider screens. */}
        <div className="flex w-full flex-col gap-5 text-left md:hidden">
          <div className="flex items-center gap-3 rounded-2xl border border-brand-line bg-white p-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-mint text-brand-green">
              <Briefcase aria-hidden className="size-[18px]" />
            </span>
            <div className="flex min-w-0 flex-col">
              <p className="text-[15px] leading-5 font-black text-brand-navy">
                {sidebar.jobTitle}
              </p>
              {sidebar.meta && (
                <p className="text-[13px] leading-[18px] text-brand-muted">
                  {sidebar.meta.location}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3.5">
            <h3 className="text-xl leading-[26px] font-black text-brand-navy">
              {sidebar.nextHeading}
            </h3>
            <ol className="flex flex-col gap-3.5">
              {sidebar.nextSteps.map((item) => (
                <li key={item.number} className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-mint text-xs font-black text-brand-green-dark">
                    {item.number}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[15px] leading-5 font-bold text-brand-navy">
                      {item.title}
                    </p>
                    <p className="text-[13px] leading-[18px] text-brand-ink">
                      {item.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col gap-3">
            <Link
              href="/careers"
              className={buttonClassName(
                { variant: "brand", size: "pill" },
                "h-[52px] w-full gap-2 py-0"
              )}
            >
              <Briefcase aria-hidden className="size-5" />
              Browse Other Roles
            </Link>
            <Link
              href="/"
              className={buttonClassName(
                { variant: "brand-outline-blue", size: "pill" },
                "h-[52px] w-full py-0"
              )}
            >
              Back to Home
            </Link>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl bg-brand-surface p-5">
            <h3 className="text-base font-black text-brand-navy">
              {sidebar.helpHeading}
            </h3>
            <a
              href={sidebar.phoneHref}
              className="flex items-center gap-3 rounded-xl bg-white px-3.5 py-3 text-sm font-bold text-brand-blue"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-brand-green text-white">
                <Phone aria-hidden className="size-4" />
              </span>
              {sidebar.phone}
            </a>
            <a
              href={`mailto:${sidebar.email}`}
              className="flex items-center gap-3 rounded-xl bg-white px-3.5 py-3 text-sm font-bold break-all text-brand-blue"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-green text-white">
                <Mail aria-hidden className="size-4" />
              </span>
              {sidebar.email}
            </a>
          </div>
        </div>
      </div>
    )

  const sections = copy.sections
  const yesNo = [
    { value: "yes" as const, label: o.yes },
    { value: "no" as const, label: o.no },
  ]
  const yn = (v: boolean | null) => (v === null ? null : v ? "yes" : "no")
  const licensed = state.psa !== "applied" && state.psa !== "no"
  const vis = (i: number) => (step === i ? undefined : "max-md:hidden")
  const reviewRows = [
    {
      title: sections[0].title,
      value: [`${state.firstName} ${state.surname}`.trim(), state.phone]
        .filter(Boolean)
        .join(" · "),
    },
    { title: sections[1].title, value: state.rightToWork ?? "" },
    { title: sections[2].title, value: state.psaCategory },
    {
      title: sections[3].title,
      value: `${state.history.length} ${state.history.length === 1 ? "period" : "periods"} added`,
    },
    { title: sections[4].title, value: state.shifts.join(", ") },
    { title: sections[5].title, value: cv ? cv.name : "" },
  ]

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit}
      onFocus={() => void turnstile.prepare()}
      className="relative flex flex-col gap-6 pb-32 max-md:px-5 md:gap-9 md:pb-0"
    >
      {/* Phones: app-style header, then the step's progress. */}
      <div className="sticky top-0 z-40 -mx-5 flex items-center gap-3 border-b border-brand-line bg-white px-5 py-2.5 md:hidden">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => goTo(step - 1)}
            aria-label="Back"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-surface text-brand-navy"
          >
            <ArrowLeft aria-hidden className="size-5" />
          </button>
        ) : (
          <Link
            href={backHref}
            aria-label="Back"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-surface text-brand-navy"
          >
            <ArrowLeft aria-hidden className="size-5" />
          </Link>
        )}
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-sm leading-5 font-black text-brand-navy">
            {sidebar.meta ? `${copy.crumb} · ${sidebar.jobTitle}` : copy.crumb}
          </p>
          <p className="truncate text-xs leading-4 text-brand-muted">
            {sidebar.meta
              ? `${sidebar.meta.location} · ${sidebar.meta.employmentType}`
              : sidebar.jobTitle}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 md:hidden" aria-live="polite">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-brand-green-dark">{`Step ${step + 1} of ${total}`}</span>
          <span className="font-medium text-brand-muted">{`~${MINUTES_LEFT[step] ?? 1} min left`}</span>
        </div>
        <div aria-hidden className="flex gap-1.5">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                i <= step ? "bg-brand-green" : "bg-brand-line"
              )}
            />
          ))}
        </div>
      </div>
      <FormSection number={1} className={vis(0)} {...sections[0]}>
        <div className="flex flex-col gap-4 md:hidden">
          <div className="flex flex-col gap-1.5 rounded-2xl bg-brand-navy p-5 text-white">
            <p className="text-xs font-black tracking-[0.08em] text-brand-green uppercase">
              {sidebar.applyingFor}
            </p>
            <p className="text-xl leading-[26px] font-black">
              {sidebar.jobTitle}
            </p>
            {sidebar.meta && (
              <p className="text-[13px] leading-[18px] text-white/80">
                {[
                  sidebar.meta.location,
                  sidebar.meta.employmentType,
                  sidebar.meta.pay,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        </div>
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

      <FormSection number={2} className={vis(1)} {...sections[1]}>
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

      <FormSection number={3} className={vis(2)} {...sections[2]}>
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

      <FormSection number={4} className={vis(3)} {...sections[3]}>
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

      <FormSection number={5} className={vis(4)} {...sections[4]}>
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

      <FormSection number={6} className={vis(5)} {...sections[5]}>
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

      <FormSection number={7} className={vis(6)} {...sections[6]}>
        <ReviewList rows={reviewRows} editLabel="Edit" onEdit={goTo} />
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
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 text-[15px] leading-normal text-brand-ink max-md:rounded-xl max-md:border max-md:p-4",
                    state.consents[i]
                      ? "max-md:border-brand-green max-md:bg-brand-mint"
                      : "max-md:border-brand-line max-md:bg-white"
                  )}
                >
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
            "w-full gap-2.5 max-md:hidden"
          )}
        >
          {sending ? copy.sendingLabel : copy.submitLabel}
          {!sending && <ArrowRight aria-hidden className="size-[18px]" />}
        </button>
        <p
          className={cn(
            "flex items-center gap-2 text-sm text-brand-muted",
            step < total - 1 && "max-md:hidden"
          )}
        >
          <Lock aria-hidden className="size-3.5" />
          {copy.secureNote}
        </p>
      </div>

      {/* Phones: the wizard's action bar. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2.5 border-t border-brand-line bg-white px-4 pt-3 pb-[max(1.75rem,env(safe-area-inset-bottom))] shadow-[0px_-6px_20px_0px_rgba(13,27,54,0.1)] md:hidden">
        {step > 0 && (
          <button
            type="button"
            onClick={() => goTo(step - 1)}
            className="flex h-[52px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-brand-blue bg-white px-7 text-base font-bold text-brand-blue"
          >
            Back
          </button>
        )}
        {step < total - 1 ? (
          <button
            type="button"
            onClick={goNext}
            className="flex h-[52px] min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-brand-green px-4 text-base font-bold text-white"
          >
            <ArrowRight aria-hidden className="size-5 shrink-0" />
            <span className="truncate">{`Next: ${sections[step + 1].title}`}</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={sending}
            className="flex h-[52px] min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-brand-green px-4 text-base font-bold text-white disabled:opacity-60"
          >
            <Send aria-hidden className="size-5 shrink-0" />
            <span className="truncate">
              {sending ? copy.sendingLabel : copy.submitLabel}
            </span>
          </button>
        )}
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

/** Phones: a read-back of the earlier steps, each with a way to change it. */
function ReviewList({
  rows,
  editLabel,
  onEdit,
}: {
  rows: { title: string; value: string }[]
  editLabel: string
  onEdit: (step: number) => void
}) {
  return (
    <ul className="flex flex-col rounded-2xl bg-brand-surface px-4 md:hidden">
      {rows.map((row, i) => (
        <li
          key={row.title}
          className="flex items-center justify-between gap-3 border-b border-brand-line py-3.5 last:border-0"
        >
          <div className="flex min-w-0 flex-col">
            <p className="text-sm leading-5 font-black text-brand-navy">
              {row.title}
            </p>
            {row.value && (
              <p className="truncate text-[13px] leading-[18px] text-brand-muted">
                {row.value}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onEdit(i)}
            className="shrink-0 text-sm font-bold text-brand-blue"
          >
            {editLabel}
          </button>
        </li>
      ))}
    </ul>
  )
}
