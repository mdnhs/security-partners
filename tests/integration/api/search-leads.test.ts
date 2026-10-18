import { beforeAll, describe, expect, it } from "vitest"

import type { SearchResult } from "@/lib/schemas/api/search"
import { getDb } from "@/server/db/client"
import { leads } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let leadId: string
let intake: string
let editor: string

beforeAll(async () => {
  await resetDb()
  await seedContent(getDb())
  const [row] = await getDb()
    .insert(leads)
    .values({
      name: "Zelda Quartz",
      email: "zelda@example.ie",
      company: "Quartz Ltd",
      message: "Hi",
    })
    .returning()
  leadId = row.id
  intake = (await signedInUser(["intake"])).cookie
  editor = (await signedInUser(["editor"])).cookie
})

const search = async (cookie: string, q: string) => {
  const res = await adminRequest(`/search?q=${encodeURIComponent(q)}`, {
    cookie,
  })
  expect(res.status).toBe(200)
  return ((await res.json()) as { items: SearchResult[] }).items
}

describe("⌘K lead results (gated on lead:read)", () => {
  it("intake finds leads by name, email or company", async () => {
    for (const q of ["zelda", "zelda@example", "quartz"])
      expect(await search(intake, q)).toEqual([
        {
          type: "lead",
          id: leadId,
          title: "Zelda Quartz",
          subtitle: "zelda@example.ie",
          href: `/admin/leads/${leadId}`,
        },
      ])
  })

  it("roles without lead:read never see leads", async () => {
    expect(
      (await search(editor, "zelda")).filter((r) => r.type === "lead")
    ).toEqual([])
  })
})
