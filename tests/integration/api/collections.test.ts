import { and, eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type {
  CategoryItem,
  ClientItem,
  TeamItem,
} from "@/lib/schemas/api/collections"
import type { Paginated } from "@/lib/schemas/api/list"
import type { ServiceDto, ServiceListItem } from "@/lib/schemas/api/services"
import { getDb } from "@/server/db/client"
import { clients, media, revisions, services } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { listMediaUsagesFor } from "@/server/modules/media/repo"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let editor: string
let viewer: string
let author: string
let logoId: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
  viewer = (await signedInUser(["viewer"])).cookie
  author = (await signedInUser(["author"])).cookie
  const [logo] = await getDb()
    .select()
    .from(media)
    .where(eq(media.key, "/images/client-hayes.png"))
  logoId = logo.id
  revalidateTag.mockClear()
})

const json = async <T>(res: Response) => (await res.json()) as T

describe("small collections (master 4.6): immediate publish + revision + audit + tag", () => {
  it("lists team members with server pagination, search and sort", async () => {
    const page1 = await json<Paginated<TeamItem>>(
      await adminRequest("/team?pageSize=2&sort=name:asc", { cookie: viewer })
    )
    expect(page1.total).toBe(4)
    expect(page1.items.map((t) => t.name)).toEqual([
      "John McDonald",
      "Louise Sheeran",
    ])
    const search = await json<Paginated<TeamItem>>(
      await adminRequest("/team?q=moran", { cookie: viewer })
    )
    expect(search.items.map((t) => t.name)).toEqual(["Sarah Moran"])
  })

  it("creates, updates and deletes a client; revisions count up per entity", async () => {
    const created = await adminRequest("/clients", {
      cookie: editor,
      method: "POST",
      json: {
        name: "Acme Retail",
        logo: { mediaId: logoId },
        url: "https://acme.example",
      },
    })
    expect(created.status).toBe(201)
    const client = await json<ClientItem>(created)
    expect(client).toMatchObject({
      name: "Acme Retail",
      url: "https://acme.example",
      logo: { mediaId: logoId },
    })
    expect(revalidateTag).toHaveBeenCalledWith("clients", { expire: 0 })
    expect(await listMediaUsagesFor(getDb(), "client", client.id)).toEqual([
      { mediaId: logoId, field: "logo" },
    ])

    const updated = await adminRequest(`/clients/${client.id}`, {
      cookie: editor,
      method: "PUT",
      json: { name: "Acme Retail Ltd", logo: { mediaId: logoId }, url: null },
    })
    expect((await json<ClientItem>(updated)).url).toBeNull()
    const revs = await getDb()
      .select({ version: revisions.version })
      .from(revisions)
      .where(
        and(
          eq(revisions.entityType, "client"),
          eq(revisions.entityId, client.id)
        )
      )
    expect(revs.map((r) => r.version).sort()).toEqual([1, 2])

    expect(
      (
        await adminRequest(`/clients/${client.id}`, {
          cookie: editor,
          method: "DELETE",
        })
      ).status
    ).toBe(200)
    expect(await listMediaUsagesFor(getDb(), "client", client.id)).toEqual([])
    expect(
      (await adminRequest(`/clients/${client.id}`, { cookie: editor })).status
    ).toBe(404)
  })

  it("rejects invalid input (422) and duplicate names (409)", async () => {
    const bad = await adminRequest("/team", {
      cookie: editor,
      method: "POST",
      json: { name: "", role: "x", bio: "x", email: "nope", photo: null },
    })
    expect(bad.status).toBe(422)
    expect(
      Object.keys(
        (await json<{ error: { fieldErrors: object } }>(bad)).error.fieldErrors
      ).sort()
    ).toEqual(["email", "name"])
    const dup = await adminRequest("/team", {
      cookie: editor,
      method: "POST",
      json: {
        name: "Sarah Moran",
        role: "x",
        bio: "x",
        email: "s@example.ie",
        photo: null,
      },
    })
    expect(dup.status).toBe(409)
    expect(
      (await json<{ error: { fieldErrors: Record<string, string[]> } }>(dup))
        .error.fieldErrors.name
    ).toBeTruthy()
    const javascriptUrl = await adminRequest("/clients", {
      cookie: editor,
      method: "POST",
      json: {
        name: "X",
        logo: { mediaId: logoId },
        url: "javascript:alert(1)",
      },
    })
    expect(javascriptUrl.status).toBe(422)
  })

  it("rejects a logo missing from the media library (422 on the field)", async () => {
    const res = await adminRequest("/clients", {
      cookie: editor,
      method: "POST",
      json: {
        name: "Ghost Ltd",
        logo: { mediaId: "0190a5b0-0000-7000-8000-000000000000" },
        url: null,
      },
    })
    expect(res.status).toBe(422)
    expect(
      (await json<{ error: { fieldErrors: Record<string, string[]> } }>(res))
        .error.fieldErrors.logo
    ).toBeTruthy()
  })

  it("will not delete a category that has articles (409)", async () => {
    const { items } = await json<Paginated<CategoryItem>>(
      await adminRequest("/categories?pageSize=50", { cookie: editor })
    )
    const news = items.find((c) => c.slug === "company-news")!
    expect(news.articleCount).toBeGreaterThan(0)
    const res = await adminRequest(`/categories/${news.id}`, {
      cookie: editor,
      method: "DELETE",
    })
    expect(res.status).toBe(409)
    expect(
      (await json<{ error: { message: string } }>(res)).error.message
    ).toContain("Move them to another category")
    const dupSlug = await adminRequest("/categories", {
      cookie: editor,
      method: "POST",
      json: { slug: "company-news", name: "Dup", showInFilter: false },
    })
    expect(dupSlug.status).toBe(409)
  })

  it("requires collection permissions", async () => {
    expect((await adminRequest("/team", { cookie: author })).status).toBe(403)
    expect(
      (
        await adminRequest("/team", {
          cookie: viewer,
          method: "POST",
          json: {},
        })
      ).status
    ).toBe(403)
  })
})

describe("services (master 4.6): draft/publish, slug, delete", () => {
  const content = async () => {
    const [row] = await getDb()
      .select()
      .from(services)
      .where(eq(services.slug, "static-security"))
    return structuredClone(row.draft)
  }

  it("creates an unpublished draft at the end; slug clash → 409", async () => {
    const draft = { ...(await content()), title: "K9 Patrols" }
    const res = await adminRequest("/services", {
      cookie: editor,
      method: "POST",
      json: { slug: "k9-patrols", draft },
    })
    expect(res.status).toBe(201)
    const created = await json<ServiceDto>(res)
    expect(created).toMatchObject({
      slug: "k9-patrols",
      title: "K9 Patrols",
      version: 1,
      published: null,
      dirty: true,
      status: "draft",
    })
    const list = await json<Paginated<ServiceListItem>>(
      await adminRequest("/services?pageSize=50", { cookie: viewer })
    )
    expect(list.items.at(-1)?.slug).toBe("k9-patrols")
    expect(revalidateTag).not.toHaveBeenCalled()

    const clash = await adminRequest("/services", {
      cookie: editor,
      method: "POST",
      json: { slug: "k9-patrols", draft },
    })
    expect(clash.status).toBe(409)
    expect(
      (await json<{ error: { fieldErrors: Record<string, string[]> } }>(clash))
        .error.fieldErrors.slug
    ).toBeTruthy()
    const badSlug = await adminRequest("/services", {
      cookie: editor,
      method: "POST",
      json: { slug: "K9 Patrols", draft },
    })
    expect(badSlug.status).toBe(422)
  })

  it("publishes (tags services + service:<slug>), changes the slug, rejects stale versions, deletes", async () => {
    const list = await json<Paginated<ServiceListItem>>(
      await adminRequest("/services?q=static", { cookie: editor })
    )
    const id = list.items[0].id
    const draft = { ...(await content()), title: "Static Guarding" }
    const saved = await json<ServiceDto>(
      await adminRequest(`/services/${id}/draft`, {
        cookie: editor,
        method: "PUT",
        json: { draft, version: 1 },
      })
    )
    expect(saved.version).toBe(2)
    const stale = await adminRequest(`/services/${id}/draft`, {
      cookie: editor,
      method: "PUT",
      json: { draft, version: 1 },
    })
    expect(stale.status).toBe(409)

    const published = await json<ServiceDto>(
      await adminRequest(`/services/${id}/publish`, {
        cookie: editor,
        method: "POST",
        json: { version: 2 },
      })
    )
    expect(published).toMatchObject({
      version: 3,
      dirty: false,
      title: "Static Guarding",
    })
    expect(revalidateTag.mock.calls).toEqual([
      ["services", { expire: 0 }],
      ["service:static-security", { expire: 0 }],
    ])

    revalidateTag.mockClear()
    const moved = await json<ServiceDto>(
      await adminRequest(`/services/${id}/slug`, {
        cookie: editor,
        method: "PATCH",
        json: { slug: "static-guarding", version: 3 },
      })
    )
    expect(moved).toMatchObject({ slug: "static-guarding", version: 4 })
    expect(revalidateTag.mock.calls.map((c) => c[0])).toEqual([
      "services",
      "service:static-security",
      "service:static-guarding",
      "redirects",
    ])

    expect(
      (
        await adminRequest(`/services/${id}?version=3`, {
          cookie: editor,
          method: "DELETE",
        })
      ).status
    ).toBe(409)
    expect(
      (
        await adminRequest(`/services/${id}?version=4`, {
          cookie: viewer,
          method: "DELETE",
        })
      ).status
    ).toBe(403)
    expect(
      (
        await adminRequest(`/services/${id}?version=4`, {
          cookie: editor,
          method: "DELETE",
        })
      ).status
    ).toBe(200)
    expect(await listMediaUsagesFor(getDb(), "service", id)).toEqual([])
  })
})

describe("concurrent saves of one record (final review minor 2)", () => {
  it("queue up on the row: all succeed, one revision each, no false duplicate-name 409", async () => {
    const client = await json<ClientItem>(
      await adminRequest("/clients", {
        cookie: editor,
        method: "POST",
        json: { name: "Race Ltd", logo: { mediaId: logoId }, url: null },
      })
    )
    const statuses = await Promise.all(
      Array.from({ length: 8 }, async (_, i) => {
        const res = await adminRequest(`/clients/${client.id}`, {
          cookie: editor,
          method: "PUT",
          json: {
            name: "Race Ltd",
            logo: { mediaId: logoId },
            url: `https://race.example/${i}`,
          },
        })
        return [res.status, await res.text()] as const
      })
    )
    expect(statuses.filter(([status]) => status !== 200)).toEqual([])
    const revs = await getDb()
      .select({ version: revisions.version })
      .from(revisions)
      .where(eq(revisions.entityId, client.id))
    expect(revs).toHaveLength(9)
    expect(await listMediaUsagesFor(getDb(), "client", client.id)).toEqual([
      { mediaId: logoId, field: "logo" },
    ])
  })
})

describe("PUT /reorder/:collection (master 4.6)", () => {
  it("persists sortOrder and invalidates the collection tag", async () => {
    const { items } = await json<Paginated<TeamItem>>(
      await adminRequest("/team", { cookie: editor })
    )
    const reversed = items.map((t) => t.id).reverse()
    const res = await adminRequest("/reorder/team", {
      cookie: editor,
      method: "PUT",
      json: { ids: reversed },
    })
    expect(res.status).toBe(200)
    const after = await json<Paginated<TeamItem>>(
      await adminRequest("/team", { cookie: editor })
    )
    expect(after.items.map((t) => t.id)).toEqual(reversed)
    expect(after.items.map((t) => t.sortOrder)).toEqual([0, 1, 2, 3])
    expect(revalidateTag).toHaveBeenCalledWith("team", { expire: 0 })
  })

  it("concurrent saves of opposite orders never deadlock (final review minor 1)", async () => {
    await getDb()
      .insert(clients)
      .values(
        Array.from({ length: 60 }, (_, i) => ({
          name: `Reorder client ${i}`,
          logoId,
        }))
      )
    const ids = (await getDb().select({ id: clients.id }).from(clients)).map(
      (c) => c.id
    )
    const save = async (order: string[]) =>
      (
        await adminRequest("/reorder/clients", {
          cookie: editor,
          method: "PUT",
          json: { ids: order },
        })
      ).status
    for (let round = 0; round < 3; round++) {
      const statuses = await Promise.all([
        save(ids),
        save([...ids].reverse()),
        save(ids),
        save([...ids].reverse()),
      ])
      expect(statuses).toEqual([200, 200, 200, 200])
    }
  })

  it("409 when the list is out of date; 403 without update permission", async () => {
    const { items } = await json<Paginated<TeamItem>>(
      await adminRequest("/team", { cookie: editor })
    )
    const res = await adminRequest("/reorder/team", {
      cookie: editor,
      method: "PUT",
      json: { ids: items.slice(1).map((t) => t.id) },
    })
    expect(res.status).toBe(409)
    expect(
      (await json<{ error: { current: { ids: string[] } } }>(res)).error.current
        .ids
    ).toHaveLength(4)
    expect(
      (
        await adminRequest("/reorder/services", {
          cookie: viewer,
          method: "PUT",
          json: { ids: [items[0].id] },
        })
      ).status
    ).toBe(403)
  })
})
