import { beforeAll, describe, expect, it } from "vitest"

import type { OptionItem, SearchResult } from "@/lib/schemas/api/search"
import { getDb } from "@/server/db/client"
import { seedContent } from "@/server/db/seed"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let editor: string
let intake: string
let marketer: string

beforeAll(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
  intake = (await signedInUser(["intake"])).cookie
  marketer = (await signedInUser(["marketer"])).cookie
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
  })

  it("treats LIKE wildcards literally and caps each type", async () => {
    expect(await search(editor, "%")).toEqual([])
    const services = (await search(editor, "s")).filter(
      (r) => r.type === "service"
    )
    expect(services.length).toBeLessThanOrEqual(5)
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

  it("enforces read permission per collection", async () => {
    expect((await options(intake, "articles")).status).toBe(403)
    expect((await options(intake, "links")).items).toEqual([])
    expect((await options(editor, "nope")).status).toBe(422)
  })
})
