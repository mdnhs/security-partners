import type { Metadata } from "next"
import { forbidden, notFound, redirect } from "next/navigation"
import { Suspense } from "react"

import { PageEditor } from "@/components/admin/pages/page-editor"
import { WebsiteTabs } from "@/components/admin/website/website-tabs"
import { HeaderFooterEditor } from "@/components/admin/website/header-footer-editor"
import { isWebsiteKey, WEBSITE_SCREENS, websiteTabs } from "@/lib/admin/website"
import { requirePage } from "@/server/auth/session"
import { getSiteOrigin } from "@/server/modules/seo/queries"

export async function generateMetadata({
  params,
}: PageProps<"/admin/website/[key]">): Promise<Metadata> {
  const { key } = await params
  const screen = WEBSITE_SCREENS.find((s) => s.key === key)
  return { title: screen?.label ?? "Website" }
}

export default function WebsiteScreenPage({
  params,
  searchParams,
}: PageProps<"/admin/website/[key]">) {
  return (
    <Suspense fallback={null}>
      <Screen params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function Screen({
  params,
  searchParams,
}: Pick<PageProps<"/admin/website/[key]">, "params" | "searchParams">) {
  const { key } = await params
  // Tolerates a caller that passes none (tests render the page directly).
  const { view } = (await searchParams) ?? {}
  // Signed in (and the screen's permission checked) before the 404, so a
  // stranger never learns which paths exist; an unknown key falls back to
  // /admin/website's guard (any signed-in user), then 404s.
  const actor = await requirePage(`/admin/website/${key}`)
  const screen = WEBSITE_SCREENS.find((s) => s.key === key)
  if (!isWebsiteKey(key) || !screen || screen.kind !== "tabs") notFound()
  // Header & footer is one form with its own tabs (settings:read, checked above).
  if (screen.key === "header-footer") return <HeaderFooterEditor />
  const tabs = websiteTabs(screen.key, actor.roles)
  if (tabs.length === 0) forbidden()
  // No Page (Header & footer, or an author on Blog): open the first part,
  // which may live at its own URL (/admin/insights).
  if (!screen.page || !tabs.some((tab) => tab.id === "page"))
    redirect(tabs[0].href)
  // Careers opens on its Jobs list; its page text is ?view=text.
  if (screen.key === "careers" && tabs[0].id !== "page" && view !== "text")
    redirect(tabs[0].href)
  return (
    <>
      <WebsiteTabs screen={screen.key} />
      <PageEditor pageKey={screen.page} origin={await getSiteOrigin()} />
    </>
  )
}
