import { connection } from "next/server"

import { isOgKind } from "@/lib/seo/urls"
import { isOgSubjectId } from "@/server/modules/seo/queries"

import { renderOgCard } from "./card"

// GET /og/:kind/:id → the generated share card (1200×630 PNG) or 404.
// :id is a page key, a service/article slug or a builder page's uuid.
// Rendering is cached (card.tsx); ids are validated before any lookup.

const notFound = () => new Response("Not found", { status: 404 })

export async function GET(
  _request: Request,
  ctx: RouteContext<"/og/[kind]/[slug]">
) {
  await connection()
  const { kind, slug } = await ctx.params
  if (!isOgKind(kind) || !isOgSubjectId(kind, slug)) return notFound()
  const png = await renderOgCard(kind, slug)
  if (!png) return notFound()
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=600, stale-while-revalidate=3600",
    },
  })
}
