import { eq, sql } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import {
  type ApplicationDto,
  type ApplicationListItem,
  ROLE_CLOSED_CODE,
  TALENT_POOL_TITLE,
} from "@/lib/schemas/api/applications"
import type { Paginated } from "@/lib/schemas/api/list"
import { app } from "@/server/api/app"
import { getDb } from "@/server/db/client"
import { auditLog, jobApplications, jobOpenings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { seedDemoJobs } from "@/server/db/seed/demo-jobs"
import { mailer } from "@/server/lib/mailer"
import { diskStorage } from "@/server/lib/storage"
import { deleteApplicationFilesJob } from "@/server/lib/jobs/delete-application-files"
import { deleteApplicationFiles } from "@/server/modules/applications/files"
import { purgeExpiredApplications } from "@/server/modules/applications/service"
import { findJobByKey } from "@/server/modules/jobs/repo"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

type ErrorBody = {
  error: {
    code: string
    message: string
    fieldErrors?: Record<string, string[]>
  }
}

let ipCounter = 0
const freshIp = () => `203.0.113.${++ipCounter}`
const OPEN = "static-security-officer"
const FILLED = "retail-security-officer"

const PDF = new TextEncoder().encode("%PDF-1.7\nfake cv\n%%EOF")
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2,
])

function answers(patch: Record<string, unknown> = {}) {
  return {
    firstName: "Aoife",
    surname: "Byrne",
    email: "aoife@example.ie",
    phone: "085 123 4567",
    address: "1 Main Street",
    town: "Portlaoise, Co. Laois",
    eircode: "R32 YX49",
    rightToWork: "Irish or UK citizen",
    permissionExpiry: "",
    psa: "valid",
    psaNumber: "01234567",
    psaCategory: "Security Guard (Static)",
    psaExpiry: "2027-06-30",
    qualifications: ["Manual Handling"],
    history: [
      {
        employer: "Advance Security Ltd",
        role: "Static Security Officer",
        from: "2021-03",
        to: "",
        reason: "",
      },
    ],
    gardaVetting: true,
    livedAbroad: false,
    experience: "3–5 years",
    startDate: "2026-12-01",
    shifts: ["Nights", "4-on-4-off roster"],
    transport: true,
    coverNote: "",
    heardFrom: "Our website",
    consents: [true, true, false],
    ...patch,
  }
}

function submit(
  opts: {
    jobSlug?: string
    submissionId?: string
    answers?: Record<string, unknown>
    cv?: File | null
    psaCard?: File | null
    website?: string
    ip?: string
  } = {}
) {
  const form = new FormData()
  form.set("jobSlug", opts.jobSlug ?? OPEN)
  form.set("submissionId", opts.submissionId ?? crypto.randomUUID())
  form.set("answers", JSON.stringify(opts.answers ?? answers()))
  if (opts.website !== undefined) form.set("website", opts.website)
  const cv =
    opts.cv === undefined
      ? new File([PDF], "Aoife CV.pdf", { type: "application/pdf" })
      : opts.cv
  if (cv) form.set("cv", cv)
  if (opts.psaCard) form.set("psaCard", opts.psaCard)
  return app.request("/api/v1/public/careers/applications", {
    method: "POST",
    headers: { "x-forwarded-for": opts.ip ?? freshIp() },
    body: form,
  })
}

const rows = () => getDb().select().from(jobApplications)

let send: ReturnType<typeof vi.spyOn>
let owner: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  await seedDemoJobs(getDb(), new Date())
  owner = (await signedInUser(["owner"])).cookie
  send = vi.spyOn(mailer, "send").mockResolvedValue({ delivered: true })
  vi.spyOn(console, "info").mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("POST /api/v1/public/careers/applications", () => {
  it("stores the application, its private files and tells HR (no attachments)", async () => {
    const res = await submit({
      psaCard: new File([PNG], "card.png", { type: "image/png" }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { ok: true; applicationId: string }
    const [row] = await rows()
    expect(body).toEqual({ ok: true, applicationId: row.id })
    expect(row).toMatchObject({
      jobSlug: OPEN,
      jobTitle: "Static Security Officer",
      name: "Aoife Byrne",
      email: "aoife@example.ie",
      status: "new",
    })
    expect(row.cv).toMatchObject({
      key: `applications/${row.id}/cv.pdf`,
      name: "Aoife CV.pdf",
      mime: "application/pdf",
      size: PDF.length,
    })
    expect(row.psaCard?.key).toBe(`applications/${row.id}/psa-card.png`)
    expect(await diskStorage().read(row.cv.key)).toEqual(PDF)

    expect(send).toHaveBeenCalledTimes(1)
    const mail = send.mock.calls[0][0] as Record<string, unknown>
    expect(mail.to).toEqual(["HR@securitypartnersltd.com"])
    expect(mail.replyTo).toBe("aoife@example.ie")
    expect(mail).not.toHaveProperty("attachments")

    const audits = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "application.created"))
    expect(audits).toHaveLength(1)
  })

  it("a closed, filled, draft or unknown role takes no application", async () => {
    const draft = await adminRequest("/jobs", {
      cookie: owner,
      method: "POST",
      json: { title: "Draft Role", slug: "draft-role" },
    })
    expect(draft.status).toBe(201)
    for (const jobSlug of [FILLED, "draft-role", "no-such-role"]) {
      const res = await submit({ jobSlug })
      expect(res.status).toBe(409)
      expect(((await res.json()) as ErrorBody).error).toMatchObject({
        code: ROLE_CLOSED_CODE,
        message: "This role is closed",
      })
    }
    expect(await rows()).toHaveLength(0)
  })

  it("the CV is required, at most 5 MB and really a PDF or Word file", async () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1)
    big.set(PDF)
    const cases = [
      null,
      new File([big], "cv.pdf", { type: "application/pdf" }),
      new File(["<!doctype html><script>x</script>"], "cv.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
      new File([PNG], "cv.png", { type: "image/png" }),
    ]
    for (const cv of cases) {
      const res = await submit({ cv })
      expect(res.status).toBe(422)
      expect(
        ((await res.json()) as ErrorBody).error.fieldErrors?.cv
      ).toHaveLength(1)
    }
    expect(await rows()).toHaveLength(0)
  })

  it("answers are validated: required fields, PSA details when licensed, options from the copy", async () => {
    let res = await submit({
      answers: answers({ firstName: "", psaNumber: "" }),
    })
    expect(res.status).toBe(422)
    let errors = ((await res.json()) as ErrorBody).error.fieldErrors ?? {}
    expect(Object.keys(errors)).toEqual(
      expect.arrayContaining(["answers.firstName", "answers.psaNumber"])
    )

    res = await submit({
      answers: answers({
        psa: "no",
        psaNumber: "",
        psaCategory: "",
        psaExpiry: "",
      }),
    })
    expect(res.status).toBe(201)

    res = await submit({ answers: answers({ rightToWork: "Martian" }) })
    expect(res.status).toBe(422)
    errors = ((await res.json()) as ErrorBody).error.fieldErrors ?? {}
    expect(errors["answers.rightToWork"]).toHaveLength(1)
  })

  it("the stored and downloaded name carries the sniffed type's extension, not the applicant's", async () => {
    const ole = new Uint8Array([
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0,
    ])
    const res = await submit({
      cv: new File([ole], "setup.msi", { type: "application/x-msi" }),
    })
    expect(res.status).toBe(201)
    const [row] = await rows()
    expect(row.cv.name).toBe("setup.doc")
    expect(row.cv.key).toBe(`applications/${row.id}/cv.doc`)
  })

  it("no job: a talent-pool application, stored without a role and sent to HR", async () => {
    const res = await submit({ jobSlug: "" })
    expect(res.status).toBe(201)
    const [row] = await rows()
    expect(row).toMatchObject({
      jobId: null,
      jobSlug: "",
      jobTitle: TALENT_POOL_TITLE,
    })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toMatchObject({
      subject: `Job application: ${TALENT_POOL_TITLE} – Aoife Byrne`,
    })
  })

  it("the honeypot looks like success and stores nothing", async () => {
    const res = await submit({ website: "http://spam.example" })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ ok: true, applicationId: null })
    expect(await rows()).toHaveLength(0)
    expect(send).not.toHaveBeenCalled()
  })

  it("the 6th attempt in 10 minutes from one IP is 429", async () => {
    const ip = freshIp()
    for (let i = 0; i < 5; i++)
      expect((await submit({ ip, jobSlug: FILLED })).status).toBe(409)
    expect((await submit({ ip })).status).toBe(429)
  })

  it("fixable 422s and retries of a stored submission do not use up the limit", async () => {
    const ip = freshIp()
    for (let i = 0; i < 6; i++)
      expect((await submit({ ip, cv: null })).status).toBe(422)
    const submissionId = crypto.randomUUID()
    for (let i = 0; i < 6; i++)
      expect((await submit({ ip, submissionId })).status).toBe(201)
    expect(await rows()).toHaveLength(1)
  })

  it("a retry of a stored submission still succeeds after the role closes", async () => {
    const submissionId = crypto.randomUUID()
    const first = (await (await submit({ submissionId })).json()) as {
      applicationId: string
    }
    await getDb()
      .update(jobOpenings)
      .set({
        published: sql`jsonb_set(${jobOpenings.published}, '{filled}', 'true')`,
      })
      .where(eq(jobOpenings.slug, OPEN))
    const retry = await submit({ submissionId })
    expect(retry.status).toBe(201)
    expect(await retry.json()).toEqual({
      ok: true,
      applicationId: first.applicationId,
    })
    expect((await submit()).status).toBe(409)
  })

  it("the same submissionId twice stores one application and answers with its id", async () => {
    const submissionId = crypto.randomUUID()
    const first = (await (await submit({ submissionId })).json()) as {
      applicationId: string
    }
    const second = await submit({ submissionId })
    expect(second.status).toBe(201)
    expect(await second.json()).toEqual({
      ok: true,
      applicationId: first.applicationId,
    })
    expect(await rows()).toHaveLength(1)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("takes a 5 MB CV (the public 64 KB limit does not apply here)", async () => {
    const cv = new Uint8Array(5 * 1024 * 1024)
    cv.set(PDF)
    const res = await submit({
      cv: new File([cv], "cv.pdf", { type: "application/pdf" }),
    })
    expect(res.status).toBe(201)
  })
})

describe("admin /applications", () => {
  async function stored() {
    const res = await submit()
    return ((await res.json()) as { applicationId: string }).applicationId
  }

  it("intake reads and updates; editor gets 403", async () => {
    const id = await stored()
    const intake = (await signedInUser(["intake"])).cookie
    const editor = (await signedInUser(["editor"])).cookie

    const list = await adminRequest("/applications?status=new", {
      cookie: intake,
    })
    expect(list.status).toBe(200)
    const page = (await list.json()) as Paginated<ApplicationListItem>
    expect(page.items.map((a) => a.id)).toEqual([id])
    expect(page.items[0].job.slug).toBe(OPEN)

    const detail = await adminRequest(`/applications/${id}`, { cookie: intake })
    const dto = (await detail.json()) as ApplicationDto
    expect(dto.answers.psaNumber).toBe("01234567")
    expect(dto.cv.name).toBe("Aoife CV.pdf")

    const patched = await adminRequest(`/applications/${id}`, {
      cookie: intake,
      method: "PATCH",
      json: { status: "shortlisted", note: "Strong night experience" },
    })
    expect(patched.status).toBe(200)
    expect((await patched.json()) as ApplicationDto).toMatchObject({
      status: "shortlisted",
      note: "Strong night experience",
    })

    expect(
      (await adminRequest("/applications", { cookie: editor })).status
    ).toBe(403)
    expect(
      (
        await adminRequest(`/applications/${id}`, {
          cookie: intake,
          method: "DELETE",
        })
      ).status
    ).toBe(403)
  })

  it("the CV downloads as an attachment, and after delete it is gone everywhere", async () => {
    const id = await stored()
    const file = await adminRequest(`/applications/${id}/files/cv`, {
      cookie: owner,
    })
    expect(file.status).toBe(200)
    expect(file.headers.get("content-disposition")).toContain("attachment")
    expect(file.headers.get("cache-control")).toBe("no-store")
    expect(file.headers.get("content-type")).toBe("application/pdf")
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(PDF)
    expect(
      (
        await adminRequest(`/applications/${id}/files/psa-card`, {
          cookie: owner,
        })
      ).status
    ).toBe(404)

    const [row] = await rows()
    const del = await adminRequest(`/applications/${id}`, {
      cookie: owner,
      method: "DELETE",
    })
    expect(del.status).toBe(200)
    expect(await rows()).toHaveLength(0)
    expect(await diskStorage().read(row.cv.key)).toBeNull()
    expect(
      (await adminRequest(`/applications/${id}/files/cv`, { cookie: owner }))
        .status
    ).toBe(404)
  })

  it("the purge removes applications older than the retention and their files", async () => {
    const oldId = await stored()
    const newId = await stored()
    const now = new Date()
    await getDb()
      .update(jobApplications)
      .set({ createdAt: new Date(now.getTime() - 400 * 86_400_000) })
      .where(eq(jobApplications.id, oldId))
    const [old] = await getDb()
      .select()
      .from(jobApplications)
      .where(eq(jobApplications.id, oldId))

    const result = await purgeExpiredApplications(now)
    expect(result.deleted).toBe(1)
    expect((await rows()).map((r) => r.id)).toEqual([newId])
    expect(await diskStorage().read(old.cv.key)).toBeNull()
  })

  it("“keep on file” keeps an application for keepOnFileMonths instead of retentionMonths", async () => {
    const now = new Date()
    const ago = (days: number) => new Date(now.getTime() - days * 86_400_000)
    const plain = await stored()
    const kept = (await (
      await submit({ answers: answers({ consents: [true, true, true] }) })
    ).json()) as { applicationId: string }
    const keptLong = (await (
      await submit({ answers: answers({ consents: [true, true, true] }) })
    ).json()) as { applicationId: string }
    // 13 months: past retentionMonths (12), within keepOnFileMonths (24).
    for (const id of [plain, kept.applicationId])
      await getDb()
        .update(jobApplications)
        .set({ createdAt: ago(400) })
        .where(eq(jobApplications.id, id))
    await getDb()
      .update(jobApplications)
      .set({ createdAt: ago(800) })
      .where(eq(jobApplications.id, keptLong.applicationId))

    const result = await purgeExpiredApplications(now)
    expect(result.deleted).toBe(2)
    expect((await rows()).map((r) => r.id)).toEqual([kept.applicationId])
  })
})

describe("a file that cannot be deleted now", () => {
  it("is queued as a retry job, which deletes it later", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const key = `applications/${crypto.randomUUID()}/cv.pdf`
    await diskStorage().put(key, PDF, "application/pdf")
    // R2 is not configured in tests: the delete cannot happen yet.
    await deleteApplicationFiles([
      {
        key,
        name: "cv.pdf",
        mime: "application/pdf",
        size: PDF.length,
        driver: "r2",
      },
    ])
    const job = await findJobByKey(getDb(), `application-file:${key}`)
    expect(job?.name).toBe("delete-application-file")

    // Once the storage answers, the job deletes it and is done.
    const result = await deleteApplicationFilesJob.run({
      now: new Date(),
      payload: { key, driver: "disk" },
    })
    expect(result.done).toBe(true)
    expect(await diskStorage().read(key)).toBeNull()
  })
})
