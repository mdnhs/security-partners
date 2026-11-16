import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { CollectionScreen } from "@/components/admin/collections/collection-screen"
import { SettingsEditor } from "@/components/admin/settings/settings-editor"
import { WebsiteTabs } from "@/components/admin/website/website-tabs"
import { isWebsiteKey, WEBSITE_SCREENS, websitePart } from "@/lib/admin/website"
import { requirePage, requirePermission } from "@/server/auth/session"

export async function generateMetadata({
  params,
}: PageProps<"/admin/website/[key]/[part]">): Promise<Metadata> {
  const { key, part } = await params
  const found = isWebsiteKey(key) ? websitePart(key, part) : undefined
  return { title: found?.label ?? "Website" }
}

export default function WebsitePartPage({
  params,
}: PageProps<"/admin/website/[key]/[part]">) {
  return (
    <Suspense fallback={null}>
      <Part params={params} />
    </Suspense>
  )
}

async function Part({
  params,
}: Pick<PageProps<"/admin/website/[key]/[part]">, "params">) {
  const { key, part: id } = await params
  // The screen's guard first, then 404 for anything not one of its parts.
  await requirePage(`/admin/website/${key}`)
  const screen = WEBSITE_SCREENS.find((s) => s.key === key)
  if (!isWebsiteKey(key) || !screen || screen.kind !== "tabs") notFound()
  const part = websitePart(screen.key, id)
  // A route part (Articles, Jobs…) lives at its own URL, not here.
  if (!part || part.source.kind === "route") notFound()
  await requirePermission(part.permission)
  return (
    <>
      <WebsiteTabs screen={screen.key} />
      {part.source.kind === "settings" ? (
        <SettingsEditor settingsKey={part.source.key} />
      ) : (
        <CollectionScreen name={part.source.name} />
      )}
    </>
  )
}
