import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"

import { SettingsEditor } from "@/components/admin/settings/settings-editor"
import {
  isEditableSettingsKey,
  SETTINGS_ENTRIES,
} from "@/lib/admin/settings-keys"
import {
  adminHrefForSettings,
  isWebsiteSettingsKey,
  withSearch,
} from "@/lib/admin/website"
import { requirePage, requirePermission } from "@/server/auth/session"

export async function generateMetadata({
  params,
}: PageProps<"/admin/settings/[key]">): Promise<Metadata> {
  const { key } = await params
  return {
    title: isEditableSettingsKey(key)
      ? SETTINGS_ENTRIES[key].label
      : "Settings",
  }
}

export default function SettingsKeyPage({
  params,
  searchParams,
}: PageProps<"/admin/settings/[key]">) {
  return (
    <Suspense fallback={null}>
      <Editor params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function Editor({
  params,
  searchParams,
}: Pick<PageProps<"/admin/settings/[key]">, "params" | "searchParams">) {
  const { key } = await params
  // The registry answers for every /admin/settings/* path by prefix
  // (permissionFor → settings:read), so a page guard alone would let any
  // settings reader through on an unknown key. Only the editable keys are
  // pages: anything else (including growth keys like customCode) is a 404,
  // and each key keeps its own read permission on top of the section's.
  if (!isEditableSettingsKey(key)) notFound()
  await requirePage("/admin/settings")
  await requirePermission(SETTINGS_ENTRIES[key].read)
  // Page content (sections, contact, navigation, footer…) moved to Website.
  if (isWebsiteSettingsKey(key))
    redirect(withSearch(adminHrefForSettings(key), await searchParams))
  return <SettingsEditor settingsKey={key} />
}
