import { beforeAll, describe, expect, it } from "vitest"

import type { OptionItem, SearchResult } from "@/lib/schemas/api/search"
import { getDb } from "@/server/db/client"
import { seedContent } from "@/server/db/seed"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let editor: string
let intake: string
let marketer: string
let viewer: string

beforeAll(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
  intake = (await signedInUser(["intake"])).cookie
  marketer = (await signedInUser(["marketer"])).cookie
  viewer = (await signedInUser(["viewer"])).cookie
})

async function search(cookie: string, q: string) {
  const res = await adminRequest(`/search?q=${encodeURIComponent(q)}`, {
    cookie,
  })
  expect(res.status).toBe(200)
  return ((await res.json()) as { items: SearchResult[] }).items
}

describe("GET /api/v1/admin/search (⌘K, master 4.1)", () => {
  it("finds pages, services and collection records an editor can read", async () => {
    const alarm = await search(editor, "alarm")
    expect(alarm.map((r) => [r.type, r.title])).toEqual([
      ["service", "Alarm Responses"],
      ["category", "Alarm Response"],
    ])
    expect(alarm[0].href).toMatch(/^\/admin\/services\/[0-9a-f-]{36}$/)
    expect(alarm[0].subtitle).toBe("/services/alarm-responses")

    const home = await search(editor, "home")
    expect(home[0]).toEqual({
      type: "page",
      id: "home",
      title: "Home",
      subtitle: "/",
      href: "/admin/pages/home",
    })

    const team = await search(editor, "moran")
    expect(team).toEqual([
      expect.objectContaining({ type: "team", title: "Sarah Moran" }),
    ])
  })

  it("filters result types by read permission", async () => {
    expect(await search(intake, "alarm")).toEqual([])
    // marketer reads pages and services but not collections
    expect((await search(marketer, "alarm")).map((r) => r.type)).toEqual([
      "service",
    ])
    // viewer reads pages, services and collections (read-only role)
    expect((await search(viewer, "alarm")).map((r) => r.type)).toEqual([
      "service",
      "category",
    ])
    expect((await search(viewer, "moran")).map((r) => r.type)).toEqual(["team"])
  })

  it("treats LIKE wildcards and the escape character literally", async () => {
    expect(await search(editor, "%")).toEqual([])
    // Unescaped, "_" would match the "-" in the slug "alarm-responses".
    expect(await search(editor, "alarm_responses")).toEqual([])
    expect(await search(editor, "_")).toEqual([])
    // A lone backslash is a literal character, not a broken escape.
    expect(await search(editor, "\\")).toEqual([])
    expect(await search(editor, "alarm\\")).toEqual([])
  })

  it("caps each type at five results", async () => {
    // All six seeded services contain an "s".
    const services = (await search(editor, "s")).filter(
      (r) => r.type === "service"
    )
    expect(services).toHaveLength(5)
  })

  it("rejects an empty query and anonymous requests", async () => {
    expect((await adminRequest("/search?q=", { cookie: editor })).status).toBe(
      422
    )
    expect((await adminRequest("/search?q=x")).status).toBe(401)
  })
})

describe("GET /api/v1/admin/search/options/:collection (SchemaForm pickers)", () => {
  async function options(cookie: string, collection: string) {
    const res = await adminRequest(`/search/options/${collection}`, { cookie })
    return {
      status: res.status,
      items: res.ok
        ? ((await res.json()) as { items: OptionItem[] }).items
        : [],
    }
  }

  it("lists articles by slug and links by URL path", async () => {
    const articles = await options(editor, "articles")
    expect(articles.status).toBe(200)
    expect(articles.items).toContainEqual({
      value: "18-years-of-watching-over-ireland",
      label: "18 Years of Watching Over Ireland",
      group: "Articles",
    })
    const links = await options(editor, "links")
    expect(links.items.map((i) => i.value)).toEqual(
      expect.arrayContaining([
        "/",
        "/contact",
        "/services/alarm-responses",
        "/blog/18-years-of-watching-over-ireland",
      ])
    )
  })

  it("lists pages and links by URL path, services by slug, categories by id", async () => {
    const pages = await options(editor, "pages")
    expect(pages.status).toBe(200)
    expect(pages.items).toHaveLength(8)
    expect(pages.items[0]).toEqual({
      value: "/",
      label: "Home",
      group: "Pages",
    })
    expect(pages.items).toContainEqual({
      value: "/privacy",
      label: "Privacy policy",
      group: "Pages",
    })

    const services = await options(editor, "services")
    expect(services.status).toBe(200)
    expect(services.items).toHaveLength(6)
    expect(services.items).toContainEqual({
      value: "alarm-responses",
      label: "Alarm Responses",
      group: "Services",
    })

    const categories = await options(editor, "categories")
    expect(categories.status).toBe(200)
    expect(categories.items).toContainEqual({
      value: expect.stringMatching(/^[0-9a-f-]{36}$/),
      label: "Alarm Response",
      group: "Categories",
    })
  })

  it("enforces read permission per collection", async () => {
    expect((await options(intake, "articles")).status).toBe(403)
    expect((await options(intake, "links")).items).toEqual([])
    expect((await options(editor, "nope")).status).toBe(422)
  })
})
