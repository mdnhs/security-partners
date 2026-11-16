import type { ReactElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * /admin/help/[slug]: signed in (requirePage, HELP_LINK's permission) before
 * any 404, so a signed-out visitor never learns which articles exist; then
 * a 404 for an unknown slug or one the role may not read.
 */
const nav = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND")
  }),
}))
vi.mock("next/navigation", () => nav)

const session = vi.hoisted(() => ({
  roles: ["owner"] as string[],
  signedIn: true,
  requirePage: vi.fn(),
}))
vi.mock("@/server/auth/session", () => ({
  requirePage: session.requirePage,
}))

const { default: HelpArticlePage, generateStaticParams } =
  await import("@/app/(admin)/admin/(panel)/help/[slug]/page")

/** The page suspends on one async child: run it as React would. */
function open(slug: string) {
  const page = HelpArticlePage({
    params: Promise.resolve({ slug }),
  }) as ReactElement<{ children: ReactElement<{ params: unknown }> }>
  const child = page.props.children
  return (child.type as (props: unknown) => Promise<ReactElement>)(child.props)
}

describe("/admin/help/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    session.roles = ["owner"]
    session.signedIn = true
    session.requirePage.mockImplementation(async () => {
      if (!session.signedIn) throw new Error("REDIRECT /admin/sign-in")
      return { id: "u1", roles: session.roles }
    })
  })

  it("prerenders every article", () => {
    expect(generateStaticParams()).toContainEqual({ slug: "media" })
  })

  it("guards with the Help page's href, then serves the article", async () => {
    const element = await open("media")
    expect(session.requirePage).toHaveBeenCalledWith("/admin/help")
    expect((element.props as { article: { slug: string } }).article.slug).toBe(
      "media"
    )
  })

  it("signs a stranger in before revealing whether a slug exists", async () => {
    session.signedIn = false
    await expect(open("nope")).rejects.toThrow("REDIRECT /admin/sign-in")
    await expect(open("media")).rejects.toThrow("REDIRECT /admin/sign-in")
    expect(nav.notFound).not.toHaveBeenCalled()
  })

  it("is a 404 for an unknown article", async () => {
    await expect(open("nope")).rejects.toThrow("NOT_FOUND")
  })

  it("is a 404 for an article about screens the role cannot open", async () => {
    session.roles = ["intake"]
    await expect(open("website-pages")).rejects.toThrow("NOT_FOUND")
    await expect(open("enquiries")).resolves.toBeDefined()
    session.roles = ["author"]
    await expect(open("blog-articles")).resolves.toBeDefined()
    await expect(open("services")).rejects.toThrow("NOT_FOUND")
  })
})
