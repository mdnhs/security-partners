import { beforeEach, describe, expect, it, vi } from "vitest"

type Rec = {
  key: string
  version: number
  draft: unknown
  published: unknown
  dirty: boolean
}

const store = vi.hoisted(() => ({ rows: {} as Record<string, unknown> }))
const calls = vi.hoisted(() => ({ list: [] as string[] }))

vi.mock("@/lib/api-client", () => {
  const rows = () => store.rows as Record<string, Rec>
  const settings = {
    ":key": {
      $get: ({ param }: { param: { key: string } }) =>
        Promise.resolve(structuredClone(rows()[param.key])),
      draft: {
        $put: ({
          param,
          json,
        }: {
          param: { key: string }
          json: { draft: unknown; version: number }
        }) => {
          calls.list.push(`draft:${param.key}@${json.version}`)
          const row = rows()[param.key]
          row.draft = json.draft
          row.version += 1
          row.dirty = true
          return Promise.resolve(structuredClone(row))
        },
      },
      publish: {
        $post: ({ param }: { param: { key: string } }) => {
          calls.list.push(`publish:${param.key}`)
          const row = rows()[param.key]
          row.published = row.draft
          row.dirty = false
          row.version += 1
          return Promise.resolve(structuredClone(row))
        },
      },
      restore: { $post: () => Promise.reject(new Error("unused")) },
    },
  }
  return { api: { settings }, unwrap: <T>(p: Promise<T>) => p }
})

import { createSettingsBundle } from "@/components/admin/website/settings-bundle"

const row = (key: string, draft: unknown, published: unknown): Rec => ({
  key,
  version: 1,
  draft,
  published,
  dirty: false,
})

beforeEach(() => {
  calls.list.length = 0
  store.rows = {
    navigation: row("navigation", { n: 1 }, { n: 1 }),
    footer: row("footer", { f: 1 }, { f: 1 }),
    microcopy: row("microcopy", { m: 1 }, { m: 1 }),
  }
})

describe("settings bundle (Header & footer as one form)", () => {
  const keys = ["navigation", "footer", "microcopy"] as const

  it("loads every key into one draft, tracking the first as the record", async () => {
    const bundle = createSettingsBundle(keys)
    const dto = await bundle.load()
    expect(dto.draft).toEqual({
      navigation: { n: 1 },
      footer: { f: 1 },
      microcopy: { m: 1 },
    })
    expect(dto.published).toEqual(dto.draft)
    expect(dto.dirty).toBe(false)
    expect(dto.key).toBe("navigation")
  })

  it("saves only the keys that changed", async () => {
    const bundle = createSettingsBundle(keys)
    const dto = await bundle.load()
    const out = await bundle.saveDraft(
      {
        navigation: { n: 1 },
        footer: { f: 2 },
        microcopy: { m: 1 },
      },
      dto.version
    )
    expect(calls.list).toEqual(["draft:footer@1"])
    expect(out.draft).toMatchObject({ footer: { f: 2 } })
    expect(out.dirty).toBe(true)
  })

  it("saves the tracked key at the editor's version", async () => {
    const bundle = createSettingsBundle(keys)
    const dto = await bundle.load()
    await bundle.saveDraft(
      { navigation: { n: 2 }, footer: { f: 1 }, microcopy: { m: 1 } },
      dto.version
    )
    expect(calls.list).toEqual([`draft:navigation@${dto.version}`])
  })

  it("publishes the changed keys with the tracked one, leaving clean keys alone", async () => {
    const bundle = createSettingsBundle(keys)
    const dto = await bundle.load()
    const saved = await bundle.saveDraft(
      { navigation: { n: 1 }, footer: { f: 2 }, microcopy: { m: 1 } },
      dto.version
    )
    calls.list.length = 0
    const out = await bundle.publish(saved.version)
    expect(calls.list).toEqual(["publish:footer", "publish:navigation"])
    expect(out.dirty).toBe(false)
    expect(out.published).toMatchObject({ footer: { f: 2 } })
  })
})
