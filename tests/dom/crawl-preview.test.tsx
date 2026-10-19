import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CrawlPreview, extractLocs } from "@/components/admin/seo/crawl-preview"

const ROBOTS = `User-Agent: *
Allow: /
Disallow: /admin

Sitemap: https://example.ie/sitemap.xml
`

const sitemap = (n: number) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from(
  { length: n },
  (_, i) => `<url>\n<loc>https://example.ie/p${i + 1}</loc>\n</url>`
).join("\n")}
</urlset>`

let responses: Record<string, () => Promise<Response>>
const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = typeof input === "string" ? input : input.toString()
  const respond = responses[url]
  return respond ? respond() : Promise.reject(new Error(`unexpected ${url}`))
})

beforeEach(() => {
  responses = {
    "/robots.txt": async () => new Response(ROBOTS, { status: 200 }),
    "/sitemap.xml": async () => new Response(sitemap(25), { status: 200 }),
  }
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe("CrawlPreview (D1.6)", () => {
  it("robots.txt tab shows the live file and a truthful note", async () => {
    render(<CrawlPreview />)
    const card = screen.getByRole("region", { name: "What crawlers see" })
    expect(card).toHaveTextContent(
      "This is the robots.txt this site serves now, in every environment. It blocks all crawlers only while the whole site is hidden from search."
    )
    expect(card).not.toHaveTextContent("Outside production")
    expect(
      screen.getByRole("tab", { name: "robots.txt", selected: true })
    ).toBeInTheDocument()
    expect(await within(card).findByText(/Disallow: \/admin/)).toBeVisible()
    expect(fetchMock).toHaveBeenCalledWith("/robots.txt", expect.anything())
  })

  it("Sitemap tab: URL count and the first 20 locations as links", async () => {
    const user = userEvent.setup()
    render(<CrawlPreview />)
    await user.click(screen.getByRole("tab", { name: "Sitemap" }))
    expect(await screen.findByText("25 URLs in the sitemap")).toBeVisible()
    const links = screen.getAllByRole("link")
    expect(links).toHaveLength(20)
    expect(links[0]).toHaveAttribute("href", "https://example.ie/p1")
    expect(links[0]).toHaveTextContent("https://example.ie/p1")
    expect(links[19]).toHaveAttribute("href", "https://example.ie/p20")
    expect(screen.getByText("Showing the first 20.")).toBeVisible()
  })

  it("a single URL reads in the singular", async () => {
    responses["/sitemap.xml"] = async () =>
      new Response(sitemap(1), { status: 200 })
    const user = userEvent.setup()
    render(<CrawlPreview />)
    await user.click(screen.getByRole("tab", { name: "Sitemap" }))
    expect(await screen.findByText("1 URL in the sitemap")).toBeVisible()
    expect(screen.queryByText("Showing the first 20.")).toBeNull()
  })

  it("fetch errors show an inline message per tab", async () => {
    responses["/robots.txt"] = async () => new Response("", { status: 500 })
    responses["/sitemap.xml"] = () => Promise.reject(new Error("offline"))
    const user = userEvent.setup()
    render(<CrawlPreview />)
    expect(
      await screen.findByText(
        "Could not load /robots.txt. Use Refresh to try again."
      )
    ).toBeVisible()
    await user.click(screen.getByRole("tab", { name: "Sitemap" }))
    expect(
      await screen.findByText(
        "Could not load /sitemap.xml. Use Refresh to try again."
      )
    ).toBeVisible()
  })

  it("Refresh refetches both files (after publishing, review M2)", async () => {
    const user = userEvent.setup()
    render(<CrawlPreview />)
    expect(await screen.findByText(/Disallow: \/admin/)).toBeVisible()
    responses["/robots.txt"] = async () =>
      new Response("User-Agent: *\nDisallow: /\n", { status: 200 })
    fetchMock.mockClear()
    const refresh = screen.getByRole("button", {
      name: "Refresh what crawlers see",
    })
    expect(refresh).toHaveClass("pointer-coarse:h-11")
    await user.click(refresh)
    expect(await screen.findByText(/Disallow: \/$/m)).toBeVisible()
    expect(fetchMock).toHaveBeenCalledWith("/robots.txt", expect.anything())
    expect(fetchMock).toHaveBeenCalledWith("/sitemap.xml", expect.anything())
  })

  it("sitemap links say they open a new tab (review M5)", async () => {
    const user = userEvent.setup()
    render(<CrawlPreview />)
    await user.click(screen.getByRole("tab", { name: "Sitemap" }))
    expect(await screen.findByText("25 URLs in the sitemap")).toBeVisible()
    expect(
      screen.getByRole("link", {
        name: "https://example.ie/p1 (opens in a new tab)",
      })
    ).toHaveAttribute("target", "_blank")
  })

  it("extractLocs: trims, decodes &amp; and ignores other tags", () => {
    expect(
      extractLocs(
        "<url><loc> https://e.ie/a?x=1&amp;y=2 </loc><lastmod>2026</lastmod></url><url><loc>https://e.ie/b</loc></url>"
      )
    ).toEqual(["https://e.ie/a?x=1&y=2", "https://e.ie/b"])
  })

  it("extractLocs: keeps only http(s) locations (review M5)", () => {
    expect(
      extractLocs(
        "<loc>javascript:alert(1)</loc><loc>//evil.example/x</loc><loc>data:text/html,x</loc><loc>http://e.ie/a</loc><loc>HTTPS://e.ie/b</loc>"
      )
    ).toEqual(["http://e.ie/a", "HTTPS://e.ie/b"])
  })
})
