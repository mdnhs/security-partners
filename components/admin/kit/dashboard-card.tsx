"use client"

import { type ReactNode, useId } from "react"

import { cn } from "@/lib/utils"

/**
 * A white card on the grey content panel, named by its heading. Client
 * component so useId stays unique across routes kept mounted by Cache
 * Components' <Activity>.
 */
export function DashboardCard({
  title,
  action,
  children,
  className,
  headingLevel = 2,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
  headingLevel?: 2 | 3
}) {
  const id = useId()
  const Heading = headingLevel === 2 ? "h2" : "h3"
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "rounded-card flex min-w-0 flex-col gap-5 bg-card p-5 text-card-foreground sm:p-6",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <Heading id={id} className="text-card-title">
          {title}
        </Heading>
        {action}
      </div>
      {children}
    </section>
  )
}
