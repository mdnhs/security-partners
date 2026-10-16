import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { SettingsEditor } from "@/components/admin/settings/settings-editor"
import {
  isEditableSettingsKey,
  SETTINGS_ENTRIES,
} from "@/lib/admin/settings-keys"
import { requirePermission } from "@/server/auth/session"

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
}: PageProps<"/admin/settings/[key]">) {
  return (
    <Suspense fallback={null}>
      <Editor params={params} />
    </Suspense>
  )
}

async function Editor({
  params,
}: Pick<PageProps<"/admin/settings/[key]">, "params">) {
  const { key } = await params
  if (!isEditableSettingsKey(key)) notFound()
  await requirePermission(SETTINGS_ENTRIES[key].read)
  return <SettingsEditor settingsKey={key} />
}
