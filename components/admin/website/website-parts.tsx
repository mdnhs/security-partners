"use client"

import Link from "next/link"

import { CollectionScreen } from "@/components/admin/collections/collection-screen"
import { useAdminSession } from "@/components/admin/session-provider"
import { FormCard } from "@/components/admin/form/form-ui"
import { websitePart, type WebsiteKey } from "@/lib/admin/website"
import { hasPermission } from "@/lib/auth/permissions"

/**
 * Lists and links that belong to a page (client logos, team members,
 * articles…), each as a card of its own among the page's sections.
 */
export function WebsiteParts({
  screen,
  ids,
}: {
  screen: WebsiteKey
  ids: readonly string[]
}) {
  const { roles } = useAdminSession()
  const parts = ids.flatMap((id) => {
    const part = websitePart(screen, id)
    return part && hasPermission(roles, part.permission) ? [part] : []
  })
  return parts.map((part) =>
    part.source.kind === "collection" ? (
      <FormCard key={part.id} id={`part-${part.id}`}>
        <CollectionScreen name={part.source.name} compact />
      </FormCard>
    ) : part.source.kind === "route" ? (
      <FormCard key={part.id} id={`part-${part.id}`} title={part.label}>
        <Link
          href={part.source.href}
          className="text-sm font-medium underline-offset-4 hover:underline"
        >
          Open {part.label.toLowerCase()}
        </Link>
      </FormCard>
    ) : null
  )
}
