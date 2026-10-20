import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({ revalidateTag }))

import { invalidate, tag } from "@/server/lib/cache-tags"

beforeEach(() => revalidateTag.mockClear())

describe("cache tags (spec §5.6)", () => {
  it("names every tag", () => {
    expect(tag.page("home")).toBe("page:home")
    expect(tag.service("alarm-responses")).toBe("service:alarm-responses")
    expect(tag.article("key-holding-explained")).toBe(
      "article:key-holding-explained"
    )
    expect(tag.settings("sections.contact")).toBe("settings:sections.contact")
    expect(tag.media("abc")).toBe("media:abc")
    expect([
      tag.services,
      tag.articles,
      tag.categories,
      tag.team,
      tag.clients,
      tag.groupCompanies,
      tag.redirects,
    ]).toEqual([
      "services",
      "articles",
      "categories",
      "team",
      "clients",
      "group-companies",
      "redirects",
    ])
  })

  it("invalidate expires each tag immediately (read-your-writes)", () => {
    invalidate(tag.services, tag.service("x"))
    expect(revalidateTag.mock.calls).toEqual([
      ["services", { expire: 0 }],
      ["service:x", { expire: 0 }],
    ])
  })
})
