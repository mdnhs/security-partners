import "server-only"

import { createElement } from "react"

import { ApplicationNotificationEmail } from "@/emails/application-notification"
import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import { isOpen } from "@/lib/careers/open"
import { formatDateTime } from "@/lib/format"
import {
  APPLICATION_STATUS_LABELS,
  type ApplicationDto,
  applicationEnvelope,
  type ApplicationFileKind,
  type ApplicationListItem,
  type ApplicationListQuery,
  CV_TYPES,
  MAX_APPLICATION_FILE_BYTES,
  PSA_CARD_TYPES,
  type StoredFile,
  type UpdateApplicationInput,
} from "@/lib/schemas/api/applications"
import type { Paginated } from "@/lib/schemas/api/list"
import type { CareersTemplate } from "@/templates/careers/schema"
import { getDb } from "@/server/db/client"
import { getEnv } from "@/server/env"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import { type DocumentMime, sniffDocument } from "@/server/lib/document-sniff"
import {
  AppError,
  fieldErrorsFromIssues,
  forbidden,
  notFound,
} from "@/server/lib/errors"
import { hashIp } from "@/server/lib/ip"
import { mailer } from "@/server/lib/mailer"
import { findJobBySlug } from "@/server/modules/jobs-board/repo"
import {
  assertHuman,
  honeypotFilled,
  retentionCutoff,
} from "@/server/modules/leads/service"
import { findPageByKey } from "@/server/modules/pages/repo"
import { readPublishedSettings } from "@/server/modules/settings/service"

import {
  deleteApplicationFiles,
  openApplicationFile,
  putApplicationFile,
  safeFileName,
} from "./files"
import * as repo from "./repo"

const errorName = (err: unknown) =>
  err instanceof Error ? err.name : "unknown error"

const invalid = (fieldErrors: Record<string, string[]>) =>
  new AppError("VALIDATION_FAILED", "Invalid input", { fieldErrors })

type FormValues = Record<string, string | File | (string | File)[]>
const textOf = (value: FormValues[string] | undefined) =>
  typeof value === "string" ? value : undefined
const fileOf = (value: FormValues[string] | undefined) =>
  value instanceof File && value.size > 0 ? value : null

type Hints = CareersTemplate["apply"]["hints"]

/** A file's bytes when it is within the size limit and really one of `types`, else its field error. */
async function checkedFile(
  file: File,
  types: readonly DocumentMime[],
  hints: Hints | null
): Promise<
  | { ok: true; bytes: Uint8Array; mime: DocumentMime; name: string }
  | { ok: false; error: string }
> {
  if (file.size > MAX_APPLICATION_FILE_BYTES)
    return {
      ok: false,
      error: hints?.fileTooLarge ?? "This file is larger than 5MB.",
    }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const mime = sniffDocument(bytes)
  if (!mime || !types.includes(mime))
    return {
      ok: false,
      error: hints?.fileWrongType ?? "This file type is not accepted.",
    }
  return { ok: true, bytes, mime, name: file.name }
}

/** Choice answers must be options of the published copy (the lists are editable). */
function optionErrors(
  answers: ReturnType<typeof applicationEnvelope.parse>["answers"],
  copy: CareersTemplate["apply"] | null
): Record<string, string[]> {
  if (!copy) return {}
  const o = copy.options
  const out: Record<string, string[]> = {}
  const one = (key: string, value: string, list: string[]) => {
    if (value !== "" && !list.includes(value))
      out[`answers.${key}`] = ["Choose one of the options"]
  }
  const many = (key: string, values: string[], list: string[]) => {
    if (values.some((v) => !list.includes(v)))
      out[`answers.${key}`] = ["Choose from the options"]
  }
  one("rightToWork", answers.rightToWork, o.rightToWork)
  if (answers.psa === "valid")
    one("psaCategory", answers.psaCategory, o.psaCategory)
  many("qualifications", answers.qualifications, o.qualifications)
  one("experience", answers.experience, o.experience)
  many("shifts", answers.shifts, o.shifts)
  one("heardFrom", answers.heardFrom, o.heardFrom)
  return out
}

async function publishedApplyCopy(): Promise<CareersTemplate["apply"] | null> {
  const row = await findPageByKey(getDb(), "careers")
  const data = row?.published as CareersTemplate | null | undefined
  return data?.apply ?? null
}

/**
 * Public application (multipart): Turnstile, honeypot, open role, answers,
 * files sniffed by bytes. Files are written first and removed again when
 * the row is not stored. One row per submissionId (a retry answers with the
 * first). HR is emailed after the commit, without attachments.
 */
export async function submitApplication(
  form: FormValues,
  meta: { ip: string | null; now?: Date }
): Promise<{ ok: true; applicationId: string | null }> {
  const now = meta.now ?? new Date()
  await assertHuman(textOf(form.turnstileToken), meta.ip)
  if (honeypotFilled(form.website)) {
    console.info("[applications] honeypot filled; submission dropped")
    return { ok: true, applicationId: null }
  }

  const job = await findJobBySlug(getDb(), textOf(form.jobSlug) ?? "")
  if (!job?.published || !job.publishedAt || !isOpen(job.published, now))
    throw new AppError("VALIDATION_FAILED", "This role is closed")

  let answers: unknown
  try {
    answers = JSON.parse(textOf(form.answers) ?? "")
  } catch {
    throw invalid({ answers: ["Invalid input"] })
  }
  const parsed = applicationEnvelope.safeParse({
    jobSlug: textOf(form.jobSlug),
    submissionId: textOf(form.submissionId),
    answers,
    turnstileToken: textOf(form.turnstileToken),
  })
  const copy = await publishedApplyCopy()
  const errors: Record<string, string[]> = parsed.success
    ? optionErrors(parsed.data.answers, copy)
    : fieldErrorsFromIssues(parsed.error.issues)

  if (parsed.success) {
    const existing = await repo.findBySubmissionId(
      getDb(),
      parsed.data.submissionId
    )
    if (existing) return { ok: true, applicationId: existing.id }
  }

  const required = copy?.hints.required ?? "Required"
  const cvFile = fileOf(form.cv)
  const cv = cvFile
    ? await checkedFile(cvFile, CV_TYPES, copy?.hints ?? null)
    : ({ ok: false, error: required } as const)
  if (!cv.ok) errors.cv = [cv.error]
  const psaFile = fileOf(form.psaCard)
  const psa = psaFile
    ? await checkedFile(psaFile, PSA_CARD_TYPES, copy?.hints ?? null)
    : null
  if (psa && !psa.ok) errors.psaCard = [psa.error]

  if (
    !parsed.success ||
    !cv.ok ||
    (psa && !psa.ok) ||
    Object.keys(errors).length
  )
    throw invalid(errors)

  const { answers: a, submissionId } = parsed.data
  const id = crypto.randomUUID()
  const stored: StoredFile[] = []
  let row: repo.ApplicationRow | null = null
  try {
    const cvStored = await putApplicationFile(id, "cv", cv)
    stored.push(cvStored)
    const psaStored = psa?.ok
      ? await putApplicationFile(id, "psa-card", psa)
      : null
    if (psaStored) stored.push(psaStored)
    row = await getDb().transaction(async (tx) => {
      const inserted = await repo.insertApplication(tx, {
        id,
        submissionId,
        jobId: job.id,
        jobTitle: job.published!.title,
        jobSlug: job.slug,
        name: `${a.firstName} ${a.surname}`,
        email: a.email,
        phone: a.phone,
        answers: a,
        cv: cvStored,
        psaCard: psaStored,
        ipHash: meta.ip ? hashIp(meta.ip) : null,
      })
      if (inserted)
        await writeAudit(tx, null, {
          action: "application.created",
          entityType: "application",
          entityId: inserted.id,
        })
      return inserted
    })
  } finally {
    // Not stored (an error, or the same submission won a race): no orphan files.
    if (!row) await deleteApplicationFiles(stored)
  }
  if (!row) {
    const first = await repo.findBySubmissionId(getDb(), submissionId)
    return { ok: true, applicationId: first?.id ?? null }
  }

  try {
    await notifyHr(row, job.published!.reference)
  } catch (err) {
    console.error(`[applications] notification failed (${errorName(err)})`)
  }
  return { ok: true, applicationId: row.id }
}

async function notifyHr(row: repo.ApplicationRow, reference: string) {
  const db = getDb()
  const [careers, site] = await Promise.all([
    readPublishedSettings("careers", db),
    readPublishedSettings("site", db),
  ])
  const recipients = careers?.recipients ?? []
  if (recipients.length === 0) {
    console.warn("[applications] no recipients in Settings ▸ Careers")
    return
  }
  const siteName = site?.name ?? "Security Partners"
  await mailer.send({
    to: recipients,
    replyTo: row.email,
    template: "application-notification",
    subject: `Job application: ${row.jobTitle} – ${row.name}`,
    react: createElement(ApplicationNotificationEmail, {
      siteName,
      adminUrl: new URL(
        `/admin/careers/applications/${row.id}`,
        getEnv().BETTER_AUTH_URL
      ).toString(),
      application: {
        name: row.name,
        email: row.email,
        phone: row.phone,
        jobTitle: row.jobTitle,
        jobReference: reference,
        receivedAt: formatDateTime(row.createdAt),
      },
    }),
  })
}

function assertCan(actor: Actor, req: PermissionRequest) {
  if (!hasPermission(actor.roles, req)) throw forbidden()
}

const fileMeta = (file: StoredFile) => ({
  name: file.name,
  mime: file.mime,
  size: file.size,
})

function toListItem(row: repo.ApplicationRow): ApplicationListItem {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    job: { id: row.jobId, title: row.jobTitle, slug: row.jobSlug },
    createdAt: row.createdAt.toISOString(),
  }
}

function toDto(row: repo.ApplicationRow): ApplicationDto {
  return {
    ...toListItem(row),
    answers: row.answers,
    cv: fileMeta(row.cv),
    psaCard: row.psaCard ? fileMeta(row.psaCard) : null,
    note: row.note,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listApplications(
  actor: Actor,
  query: ApplicationListQuery
): Promise<Paginated<ApplicationListItem>> {
  assertCan(actor, { application: ["read"] })
  const { rows, total } = await repo.listApplicationRows(getDb(), {
    filters: {
      status: query.status,
      jobId: query.job,
      q: query.q || undefined,
    },
    page: query.page,
    pageSize: query.pageSize,
  })
  return {
    items: rows.map(toListItem),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function getApplication(
  actor: Actor,
  id: string
): Promise<ApplicationDto> {
  assertCan(actor, { application: ["read"] })
  const row = await repo.findApplicationRow(getDb(), id)
  if (!row) throw notFound("Application")
  return toDto(row)
}

export async function updateApplication(
  actor: Actor,
  id: string,
  input: UpdateApplicationInput
): Promise<ApplicationDto> {
  assertCan(actor, { application: ["update"] })
  await getDb().transaction(async (tx) => {
    const row = await repo.lockApplicationRow(tx, id)
    if (!row) throw notFound("Application")
    const patch: { status?: typeof row.status; note?: string } = {}
    const diff: Record<string, { from: unknown; to: unknown }> = {}
    if (input.status !== undefined && input.status !== row.status) {
      patch.status = input.status
      diff.status = {
        from: APPLICATION_STATUS_LABELS[row.status],
        to: APPLICATION_STATUS_LABELS[input.status],
      }
    }
    // The note's text stays out of the audit log (it may hold personal data).
    if (input.note !== undefined && input.note !== row.note)
      patch.note = input.note
    if (Object.keys(patch).length === 0) return
    await repo.updateApplicationRow(tx, id, patch)
    await writeAudit(tx, actor, {
      action: "application.updated",
      entityType: "application",
      entityId: id,
      diff: {
        ...diff,
        ...(patch.note !== undefined ? { note: { from: "…", to: "…" } } : {}),
      },
    })
  })
  return getApplication(actor, id)
}

/** GDPR erasure: the row, then its stored files. The audit row keeps no personal data. */
export async function deleteApplication(
  actor: Actor,
  id: string
): Promise<{ ok: true }> {
  assertCan(actor, { application: ["delete"] })
  const row = await getDb().transaction(async (tx) => {
    const deleted = await repo.deleteApplicationRow(tx, id)
    if (!deleted) throw notFound("Application")
    await writeAudit(tx, actor, {
      action: "application.deleted",
      entityType: "application",
      entityId: id,
    })
    return deleted
  })
  await deleteApplicationFiles([row.cv, row.psaCard])
  return { ok: true }
}

/** A stored file for download (attachment); 404 when the application or file is gone. */
export async function applicationFile(
  actor: Actor,
  id: string,
  kind: ApplicationFileKind
) {
  assertCan(actor, { application: ["read"] })
  const row = await repo.findApplicationRow(getDb(), id)
  const file = row ? (kind === "cv" ? row.cv : row.psaCard) : null
  if (!row || !file) throw notFound("File")
  const stored = await openApplicationFile(file)
  if (!stored) throw notFound("File")
  return {
    body: stored.body,
    size: stored.size,
    mime: file.mime,
    name: safeFileName(file.name, kind),
  }
}

export async function applicationBadge(
  actor: Actor
): Promise<{ newApplications: number }> {
  assertCan(actor, { application: ["read"] })
  return { newApplications: await repo.countNewApplications(getDb()) }
}

/**
 * Daily retention purge: applications older than
 * settings.careers.retentionMonths, and their files. Audits the count only.
 */
export async function purgeExpiredApplications(
  now: Date = new Date()
): Promise<{
  deleted: number
  cutoff: Date | null
}> {
  const db = getDb()
  const config = await readPublishedSettings("careers", db)
  if (!config) return { deleted: 0, cutoff: null }
  const cutoff = retentionCutoff(now, config.retentionMonths)
  const rows = await db.transaction(async (tx) => {
    const deleted = await repo.deleteApplicationsCreatedBefore(tx, cutoff)
    if (deleted.length > 0)
      await writeAudit(tx, null, {
        action: "application.purged",
        entityType: "application",
        diff: { count: deleted.length, cutoff: cutoff.toISOString() },
      })
    return deleted
  })
  await deleteApplicationFiles(rows.flatMap((r) => [r.cv, r.psaCard]))
  return { deleted: rows.length, cutoff }
}
