"use client"

import { RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"

import { DashboardCard } from "@/components/admin/kit/dashboard-card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

/** Sitemap locations listed in the preview; the rest are only counted. */
export const CRAWL_PREVIEW_LIMIT = 20

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
}

/**
 * http(s) <loc> values of a sitemap, trimmed and entity-decoded, in order.
 * Anything else (javascript:, data:, protocol-relative) is dropped: they
 * become links.
 */
export function extractLocs(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>([\s\S]*?)<\/loc>/g), (m) =>
    m[1].trim().replace(/&(?:amp|lt|gt|quot|apos);/g, (e) => XML_ENTITIES[e])
  ).filter((loc) => /^https?:\/\//i.test(loc))
}

type Fetched =
  { state: "loading" } | { state: "error" } | { state: "done"; text: string }

/**
 * The live (same-origin) file, never cached; refetched on mount and
 * whenever `nonce` changes (the Refresh button).
 */
function usePublicFile(path: string, nonce: number): Fetched {
  const [result, setResult] = useState<Fetched>({ state: "loading" })
  const [loaded, setLoaded] = useState({ path, nonce })
  // Back to "loading" on a refetch (render-time reset, no effect setState).
  if (loaded.path !== path || loaded.nonce !== nonce) {
    setLoaded({ path, nonce })
    setResult({ state: "loading" })
  }
  useEffect(() => {
    const controller = new AbortController()
    fetch(path, { cache: "no-store", signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const text = await res.text()
        if (!controller.signal.aborted) setResult({ state: "done", text })
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ state: "error" })
      })
    return () => controller.abort()
  }, [path, nonce])
  return result
}

function Status({ result, path }: { result: Fetched; path: string }) {
  if (result.state === "loading")
    return (
      <p role="status" className="text-muted-foreground">
        Loading {path}…
      </p>
    )
  return (
    <p role="status" className="text-destructive">
      Could not load {path}. Use Refresh to try again.
    </p>
  )
}

function RobotsPanel({ result }: { result: Fetched }) {
  if (result.state !== "done")
    return <Status result={result} path="/robots.txt" />
  return (
    <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
      {result.text}
    </pre>
  )
}

function SitemapPanel({ result }: { result: Fetched }) {
  if (result.state !== "done")
    return <Status result={result} path="/sitemap.xml" />
  const locs = extractLocs(result.text)
  const shown = locs.slice(0, CRAWL_PREVIEW_LIMIT)
  return (
    <div className="flex flex-col gap-2">
      <p className="font-semibold">
        {locs.length} {locs.length === 1 ? "URL" : "URLs"} in the sitemap
      </p>
      {shown.length > 0 && (
        <ul className="flex flex-col gap-1">
          {shown.map((loc, i) => (
            <li key={`${i}-${loc}`} className="min-w-0">
              <a
                href={loc}
                target="_blank"
                rel="noreferrer"
                className="inline-block break-all text-primary underline-offset-4 hover:underline pointer-coarse:py-2.5"
              >
                {loc} <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {locs.length > CRAWL_PREVIEW_LIMIT && (
        <p className="text-muted-foreground">
          Showing the first {CRAWL_PREVIEW_LIMIT}.
        </p>
      )}
    </div>
  )
}

/**
 * Aside on SEO › Defaults: the live robots.txt and sitemap.xml this
 * origin serves (published settings only, so draft changes show after
 * publishing; Refresh fetches both files again).
 */
export function CrawlPreview() {
  const [nonce, setNonce] = useState(0)
  const robots = usePublicFile("/robots.txt", nonce)
  const sitemap = usePublicFile("/sitemap.xml", nonce)
  const loading = robots.state === "loading" || sitemap.state === "loading"
  return (
    <DashboardCard
      title="What crawlers see"
      headingLevel={2}
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="pointer-coarse:h-11"
          aria-label="Refresh what crawlers see"
          disabled={loading}
          onClick={() => setNonce((n) => n + 1)}
        >
          <RefreshCw aria-hidden data-icon="inline-start" />
          Refresh
        </Button>
      }
    >
      <Tabs defaultValue="robots">
        <TabsList>
          <TabsTrigger value="robots">robots.txt</TabsTrigger>
          <TabsTrigger value="sitemap">Sitemap</TabsTrigger>
        </TabsList>
        <TabsContent value="robots" className="pt-3">
          <RobotsPanel result={robots} />
        </TabsContent>
        <TabsContent value="sitemap" className="pt-3">
          <SitemapPanel result={sitemap} />
        </TabsContent>
      </Tabs>
      <p className="text-sm text-muted-foreground">
        This is the robots.txt this site serves now, in every environment. It
        blocks all crawlers only while the whole site is hidden from search.
      </p>
    </DashboardCard>
  )
}
