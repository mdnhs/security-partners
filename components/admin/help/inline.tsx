import Link from "next/link"
import { Fragment } from "react"

import { Kbd } from "@/components/ui/kbd"
import { canFollow } from "@/lib/admin/help/registry"

/**
 * The docs' inline markup (lib/admin/help/types.ts): **bold**, `key` and
 * [label](href). A link the viewer cannot follow (a screen their role does
 * not open) renders as its label only, so the docs never lead to a 403.
 */
const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g

export function HelpText({
  text,
  roles,
}: {
  text: string
  roles: readonly string[]
}) {
  const parts = text.split(TOKEN).filter(Boolean)
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={index} className="font-semibold text-foreground">
              {part.slice(2, -2)}
            </strong>
          )
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <Kbd key={index} className="align-baseline">
              {part.slice(1, -1)}
            </Kbd>
          )
        }
        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
        if (link) {
          const label = link[1]!
          const href = link[2]!
          return canFollow(roles, href) ? (
            <Link
              key={index}
              href={href}
              className="font-medium text-primary underline underline-offset-4 hover:no-underline"
            >
              {label}
            </Link>
          ) : (
            <Fragment key={index}>{label}</Fragment>
          )
        }
        return <Fragment key={index}>{part}</Fragment>
      })}
    </>
  )
}
