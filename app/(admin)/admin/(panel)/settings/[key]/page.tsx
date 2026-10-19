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
  // The registry answers for every /admin/settings/* path by prefix
  // (permissionFor → settings:read), so a page guard alone would let any
  // settings reader through on an unknown key. Only the editable keys are
  // pages: anything else (including growth keys like customCode) is a 404.
  if (!isEditableSettingsKey(key)) notFound()
  await requirePermission(SETTINGS_ENTRIES[key].read)
  return <SettingsEditor settingsKey={key} />
}
