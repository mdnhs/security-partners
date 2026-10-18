import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { ImageResponse } from "next/og"
import { connection } from "next/server"

import { ogCard } from "@/lib/seo/og-card"
import { isOgKind, OG_IMAGE_SIZE } from "@/lib/seo/urls"
import { publicOrigin } from "@/server/lib/site-origin"
import { getOgSubject } from "@/server/modules/seo/queries"

// Generated share card (spec §10: "OG images generated with next/og in the
// site's existing fonts/colours"): Lato, brand navy/green/mint from
// app/globals.css. Used when a record has no share image of its own.

const NAVY = "#0d1b36"
const GREEN = "#67bd31"
const MINT = "#eef6e8"

let fonts: Promise<[Buffer, Buffer]> | null = null
function loadFonts() {
  fonts ??= Promise.all([
    readFile(join(process.cwd(), "assets/fonts/lato-latin-400-normal.woff")),
    readFile(join(process.cwd(), "assets/fonts/lato-latin-900-normal.woff")),
  ]).catch((error: unknown) => {
    fonts = null // retry on the next request instead of caching the failure
    throw error
  })
  return fonts
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/og/[kind]/[slug]">
) {
  await connection()
  const { kind, slug } = await ctx.params
  if (!isOgKind(kind)) return new Response("Not found", { status: 404 })
  const subject = await getOgSubject(kind, slug)
  if (!subject) return new Response("Not found", { status: 404 })
  const card = ogCard({
    kind,
    title: subject.title,
    siteName: subject.siteName,
    origin: publicOrigin(subject.productionUrl),
  })
  const [regular, black] = await loadFonts()
  // Satori: every element with more than one child needs display:flex, so
  // each text is a single template-literal child.
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: "72px 80px",
        background: NAVY,
        color: "#ffffff",
        fontFamily: "Lato",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            display: "flex",
            width: 56,
            height: 8,
            borderRadius: 4,
            background: GREEN,
          }}
        />
        <div
          style={{
            display: "flex",
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: GREEN,
          }}
        >
          {`${card.eyebrow}`}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: card.titleSize,
          fontWeight: 900,
          lineHeight: 1.1,
        }}
      >
        {`${card.title}`}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 28,
          fontWeight: 400,
          color: MINT,
        }}
      >
        <div style={{ display: "flex" }}>{`${card.siteName}`}</div>
        <div style={{ display: "flex" }}>{`${card.host}`}</div>
      </div>
    </div>,
    {
      ...OG_IMAGE_SIZE,
      fonts: [
        { name: "Lato", data: regular, weight: 400, style: "normal" },
        { name: "Lato", data: black, weight: 900, style: "normal" },
      ],
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    }
  )
}
