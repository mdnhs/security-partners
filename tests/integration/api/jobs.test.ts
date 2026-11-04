import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type { JobDto, JobListItem } from "@/lib/schemas/api/jobs"
import { getDb } from "@/server/db/client"
import { redirects } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import {
  getJobBySlug,
  isPublishedJobSlug,
  listOpenJobs,
  listPreviousJobs,
} from "@/server/modules/jobs-board/queries"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

type ErrorBody = {
  error: {
    code: string
    message: string
    fieldErrors?: Record<string, string[]>
  }
}

let editor: string
let marketer: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
  marketer = (await signedInUser(["marketer"])).cookie
  revalidateTag.mockClear()
})

const NOW = new Date("2026-11-10T12:00:00Z")

async function create(
  slug: string,
  title = "Static Security Officer",
  cookie = editor
) {
  const res = await adminRequest("/jobs", {
    cookie,
    method: "POST",
    json: { title, slug },
  })
  expect(res.status).toBe(201)
  return (await res.json()) as JobDto
}

const saveDraft = (job: JobDto, patch: Record<string, unknown>) =>
  adminRequest(`/jobs/${job.id}/draft`, {
    cookie: editor,
    method: "PUT",
    json: {
      version: job.version,
      draft: { ...(job.draft as object), ...patch },
    },
  })

async function publishWith(job: JobDto, patch: Record<string, unknown> = {}) {
  const saved = (await (await saveDraft(job, patch)).json()) as JobDto
  const res = await adminRequest(`/jobs/${job.id}/publish`, {
    cookie: editor,
    method: "POST",
    json: { version: saved.version },
  })
  expect(res.status).toBe(200)
  return (await res.json()) as JobDto
}

describe("jobs admin API", () => {
  it("creates a valid draft at /careers/<slug> from a title", async () => {
    const job = await create("static-security-officer")
    expect(job).toMatchObject({
      slug: "static-security-officer",
      path: "/careers/static-security-officer",
      status: "draft",
      published: null,
      title: "Static Security Officer",
    })
    const list = (await (
      await adminRequest("/jobs", { cookie: editor })
    ).json()) as {
      items: JobListItem[]
    }
    expect(list.items.map((j) => j.slug)).toEqual(["static-security-officer"])
  })

  it("refuses a malformed or taken address", async () => {
    await create("cctv-operator")
    const bad = await adminRequest("/jobs", {
      cookie: editor,
      method: "POST",
      json: { title: "X", slug: "Bad Slug" },
    })
    expect(bad.status).toBe(422)
    const taken = await adminRequest("/jobs", {
      cookie: editor,
      method: "POST",
      json: { title: "Y", slug: "cctv-operator" },
    })
    expect(taken.status).toBe(409)
    expect(
      ((await taken.json()) as ErrorBody).error.fieldErrors?.slug
    ).toBeTruthy()
  })

  it("validates the draft against the job content", async () => {
    const job = await create("event-steward")
    const res = await saveDraft(job, { closingDate: "30/11/2026" })
    expect(res.status).toBe(422)
    expect(
      ((await res.json()) as ErrorBody).error.fieldErrors?.closingDate
    ).toBeTruthy()
  })

  it("publishing needs job:publish (editor yes, marketer no)", async () => {
    const job = await create("mobile-patrol")
    const res = await adminRequest(`/jobs/${job.id}/publish`, {
      cookie: marketer,
      method: "POST",
      json: { version: job.version },
    })
    expect(res.status).toBe(403)
    expect((await adminRequest("/jobs", { cookie: marketer })).status).toBe(200)
    await publishWith(job)
    expect(await isPublishedJobSlug("mobile-patrol")).toBe(true)
  })

  it("a new address for a published job leaves a 301 from the old one", async () => {
    const live = await publishWith(await create("site-officer"))
    const res = await adminRequest(`/jobs/${live.id}/slug`, {
      cookie: editor,
      method: "PATCH",
      json: { slug: "site-security-officer", version: live.version },
    })
    expect(res.status).toBe(200)
    const [move] = await getDb()
      .select({ toPath: redirects.toPath })
      .from(redirects)
      .where(eq(redirects.fromPath, "/careers/site-officer"))
    expect(move.toPath).toBe("/careers/site-security-officer")
  })

  it("a live job address cannot become a redirect source", async () => {
    await publishWith(await create("installer"))
    const res = await adminRequest("/redirects", {
      cookie: marketer,
      method: "POST",
      json: { fromPath: "/careers/installer", toPath: "/", code: 301 },
    })
    expect(res.status).toBe(422)
  })
})

describe("public job readers", () => {
  it("open: published, not filled, closing today or later; newest posted first", async () => {
    const a = await publishWith(await create("job-a", "A"), {
      closingDate: "2026-12-01",
    })
    await new Promise((r) => setTimeout(r, 5))
    const b = await publishWith(await create("job-b", "B"), {
      closingDate: "2026-12-05",
    })
    await publishWith(await create("job-expired", "C"), {
      closingDate: "2026-11-01",
    })
    await publishWith(await create("job-filled", "D"), {
      closingDate: "2026-12-30",
      filled: true,
    })
    await create("job-draft", "E")
    expect((await listOpenJobs(NOW)).map((j) => j.slug)).toEqual([
      b.slug,
      a.slug,
    ])
    expect((await listPreviousJobs(NOW)).map((j) => j.slug)).toEqual([
      "job-filled",
      "job-expired",
    ])
  })

  it("reads a published job by address; a draft only in preview", async () => {
    await create("job-draft")
    expect(await getJobBySlug("job-draft")).toBeNull()
    expect((await getJobBySlug("job-draft", true))?.slug).toBe("job-draft")
    await publishWith(await create("job-live", "Live"))
    expect((await getJobBySlug("job-live"))?.content.title).toBe("Live")
  })

  it("deleting removes it from every list and from its address", async () => {
    const live = await publishWith(await create("job-gone"), {
      closingDate: "2026-12-01",
    })
    const res = await adminRequest(`/jobs/${live.id}?version=${live.version}`, {
      cookie: editor,
      method: "DELETE",
    })
    expect(res.status).toBe(200)
    expect(await listOpenJobs(NOW)).toEqual([])
    expect(await isPublishedJobSlug("job-gone")).toBe(false)
    expect(revalidateTag).toHaveBeenCalledWith("jobs", { expire: 0 })
  })
})
