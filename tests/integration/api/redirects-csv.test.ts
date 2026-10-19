import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import { parseCsv } from "@/lib/csv"
import type { RedirectDto } from "@/lib/schemas/api/redirects"
import { getDb } from "@/server/db/client"
import { auditLog, redirects } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import type { ImportRow } from "@/server/modules/redirects/service"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let marketer: string
let viewer: string
let editor: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  marketer = (await signedInUser(["marketer"])).cookie
  viewer = (await signedInUser(["viewer"])).cookie
  editor = (await signedInUser(["editor"])).cookie
})

type ImportResult = { rows: ImportRow[]; created: number; updated: number }
type ErrorBody = {
  error: { code: string; message: string; current?: { rows: ImportRow[] } }
}

const importCsv = (
  csv: string,
  mode: "preview" | "commit",
  cookie = marketer
) =>
  adminRequest("/redirects/import", {
    cookie,
    method: "POST",
    json: { csv, mode },
  })

const allRedirects = () =>
  getDb().select().from(redirects).orderBy(redirects.fromPath)

const create = async (json: Record<string, unknown>) => {
  const res = await adminRequest("/redirects", {
    cookie: marketer,
    method: "POST",
    json: { code: 301, ...json },
  })
  expect(res.status, JSON.stringify(json)).toBe(201)
  return (await res.json()) as RedirectDto
}

const auditActions = async (action: string) =>
  getDb()
    .select({ diff: auditLog.diff })
    .from(auditLog)
    .where(eq(auditLog.action, action))

/** Hostile/messy file (D1 review focus 1): BOM, CRLF, quotes, blanks, formulas. */
const MESSY = [
  "﻿From , TO,Code,note",
  '/promo-a,/contact,302,"Spring, ""flyer"""', // 2 ok (create)
  "", // 3 blank
  "/promo-a,/about,,dup", // 4 duplicate from in the file
  "/admin/x,/contact,,", // 5 reserved path
  "/loop-1,/loop-2,,", // 6 ok
  "/loop-2,/loop-1,,", // 7 loop with line 6
  '"=HYPERLINK(""http://evil.example"",""x"")",/,,', // 8 formula as a path
  "/open,//evil.example,,", // 9 open redirect
  "/js,javascript:alert(1),,", // 10 open redirect
  "/code-bad,/,303,", // 11 code
  "/services/alarm-responses,/,,", // 12 live page
  "/self,/self,,", // 13 loop on itself
  `/long-note,/,,${"n".repeat(201)}`, // 14 note too long
  "/existing-loop,/existing,,", // 15 loop with an existing redirect
  "/ext,https://example.org/x,308,=SUM(1)", // 16 ok: https target, formula note kept as text
].join("\r\n")

describe("redirects CSV import (D1.8)", () => {
  it("preview flags duplicate from, bad path, chain; commit is all-or-nothing", async () => {
    await create({ fromPath: "/existing", toPath: "/existing-loop" })
    const before = await allRedirects()

    const res = await importCsv(MESSY, "preview")
    expect(res.status).toBe(200)
    const preview = (await res.json()) as ImportResult
    const byLine = new Map(preview.rows.map((r) => [r.line, r]))
    expect([...byLine.keys()]).toEqual([
      2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ])
    expect(byLine.get(2)).toMatchObject({
      from: "/promo-a",
      to: "/contact",
      code: 302,
      note: 'Spring, "flyer"',
      status: "create",
    })
    expect(byLine.get(4)).toMatchObject({ status: "error" })
    expect(byLine.get(4)!.message).toMatch(/line 2/)
    for (const line of [5, 7, 8, 9, 10, 11, 12, 13, 14, 15])
      expect(byLine.get(line)!.status, `line ${line}`).toBe("error")
    expect(byLine.get(7)!.message).toMatch(/loop/)
    expect(byLine.get(12)!.message).toMatch(/live page/)
    expect(byLine.get(15)!.message).toMatch(/loop/)
    expect(byLine.get(16)).toMatchObject({
      status: "create",
      code: 308,
      note: "=SUM(1)",
    })
    expect(preview.created).toBe(3)
    expect(preview.updated).toBe(0)
    // Preview writes nothing.
    expect(await allRedirects()).toEqual(before)

    const commit = await importCsv(MESSY, "commit")
    expect(commit.status).toBe(422)
    const body = (await commit.json()) as ErrorBody
    expect(body.error.code).toBe("VALIDATION_FAILED")
    expect(body.error.message).toMatch(/Nothing was imported/)
    expect(body.error.current?.rows).toEqual(preview.rows)
    // Nothing written, not even the valid rows.
    expect(await allRedirects()).toEqual(before)
    expect(await auditActions("redirect.imported")).toHaveLength(0)
  })

  it("commits a clean file in one go: source import, one audit entry with counts only", async () => {
    await create({ fromPath: "/old", toPath: "/about", note: "keep?" })
    const csv = [
      "from,to,code,note",
      "/old,/contact,302,moved again",
      "/new-a,/services,,",
      "/new-b,/new-a,307,",
    ].join("\n")
    const res = await importCsv(csv, "commit")
    expect(res.status).toBe(200)
    const result = (await res.json()) as ImportResult
    expect(result).toMatchObject({ created: 2, updated: 1 })
    expect(result.rows.map((r) => r.status)).toEqual([
      "update",
      "create",
      "create",
    ])
    const rows = await allRedirects()
    expect(
      rows.map((r) => [r.fromPath, r.toPath, r.code, r.note, r.source])
    ).toEqual([
      ["/new-a", "/services", 301, "", "import"],
      ["/new-b", "/new-a", 307, "", "import"],
      ["/old", "/contact", 302, "moved again", "import"],
    ])
    expect(rows.every((r) => r.isActive)).toBe(true)
    const audits = await auditActions("redirect.imported")
    expect(audits).toHaveLength(1)
    expect(audits[0].diff).toEqual({ created: 2, updated: 1, rows: 3 })
    expect(revalidateTag).toHaveBeenCalled()
  })

  it("a chain built across rows over the hop limit is refused", async () => {
    // /h1 → /h2 → … → /h7: the 6th row makes a 6-hop chain.
    const csv = [
      "from,to",
      ...[1, 2, 3, 4, 5, 6].map((n) => `/h${n},/h${n + 1}`),
    ].join("\r\n")
    const preview = (await (
      await importCsv(csv, "preview")
    ).json()) as ImportResult
    expect(preview.rows.map((r) => r.status)).toEqual([
      "create",
      "create",
      "create",
      "create",
      "create",
      "error",
    ])
    expect(preview.rows[5].message).toMatch(/Too many hops/)
  })

  it("refuses broken files, missing columns, empty files and > 1000 rows (422, nothing written)", async () => {
    const cases: [string, RegExp][] = [
      ['from,to\r\n/a,"/b\r\n', /^Line 2: /],
      ["source,target\r\n/a,/b\r\n", /from and to/],
      ["from,to\r\n\r\n", /No redirects/],
      [
        ["from,to", ...Array.from({ length: 1001 }, (_, i) => `/r${i},/`)].join(
          "\r\n"
        ),
        /^Line 1002: more than 1000 rows/,
      ],
    ]
    for (const [csv, message] of cases) {
      for (const mode of ["preview", "commit"] as const) {
        const res = await importCsv(csv, mode)
        expect(res.status, `${mode} ${message}`).toBe(422)
        expect(((await res.json()) as ErrorBody).error.message).toMatch(message)
      }
    }
    // Exactly 1000 is fine.
    const thousand = [
      "from,to",
      ...Array.from({ length: 1000 }, (_, i) => `/r${i},/`),
    ].join("\r\n")
    const ok = await importCsv(thousand, "commit")
    expect(ok.status).toBe(200)
    expect(((await ok.json()) as ImportResult).created).toBe(1000)
    // Bad mode / not a string.
    for (const json of [
      { csv: "from,to", mode: "apply" },
      { csv: 1, mode: "preview" },
    ]) {
      const res = await adminRequest("/redirects/import", {
        cookie: marketer,
        method: "POST",
        json,
      })
      expect(res.status).toBe(422)
    }
  })

  it("a body over the admin limit (1 MB) is refused with 413", async () => {
    const res = await importCsv(
      `from,to,note\r\n/a,/,${"x".repeat(1024 * 1024)}\r\n`,
      "preview"
    )
    expect(res.status).toBe(413)
  })

  it("only roles that may create and update redirects can import", async () => {
    const csv = "from,to\r\n/x,/\r\n"
    expect((await importCsv(csv, "preview", viewer)).status).toBe(403)
    expect((await importCsv(csv, "commit", editor)).status).toBe(403)
    expect(await allRedirects()).toHaveLength(0)
  })
})

describe("redirects CSV export (D1.8)", () => {
  it("round-trips export → import as updates", async () => {
    await create({ fromPath: "/a", toPath: "/about", note: "=SUM(1)" })
    await create({
      fromPath: "/b",
      toPath: "https://example.org/x",
      code: 308,
      note: '-minus, "quoted"',
    })
    const res = await adminRequest("/redirects/export.csv", { cookie: viewer })
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toMatch(/^text\/csv/)
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="redirects-\d{4}-\d{2}-\d{2}\.csv"$/
    )
    expect(res.headers.get("cache-control")).toBe("no-store")
    // res.text() would drop the BOM: check the raw bytes (EF BB BF).
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const csv = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes)
    expect(csv.startsWith("﻿")).toBe(true)
    const parsed = parseCsv(csv)
    expect(parsed.header).toEqual([
      "from",
      "to",
      "code",
      "active",
      "note",
      "hits",
      "last_hit_at",
      "source",
    ])
    expect(parsed.rows).toEqual([
      ["/a", "/about", "301", "yes", "'=SUM(1)", "0", "", "manual"],
      [
        "/b",
        "https://example.org/x",
        "308",
        "yes",
        `'-minus, "quoted"`,
        "0",
        "",
        "manual",
      ],
    ])
    // Formula guard in the raw file.
    expect(csv).toContain("'=SUM(1)")

    const imported = await importCsv(csv, "commit")
    expect(imported.status).toBe(200)
    expect((await imported.json()) as ImportResult).toMatchObject({
      created: 0,
      updated: 2,
    })
    const rows = await allRedirects()
    expect(rows.map((r) => [r.fromPath, r.toPath, r.code, r.note])).toEqual([
      ["/a", "/about", 301, "=SUM(1)"],
      ["/b", "https://example.org/x", 308, '-minus, "quoted"'],
    ])
    const exported = await auditActions("redirect.exported")
    expect(exported.map((a) => a.diff)).toEqual([{ count: 2 }])
  })

  it("editors cannot export", async () => {
    expect(
      (await adminRequest("/redirects/export.csv", { cookie: editor })).status
    ).toBe(403)
  })
})
