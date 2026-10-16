import type { ReactNode } from "react"

/** Title block + form for every admin auth page (JW AuthHeader; no card chrome). */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-[2rem] leading-tight font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </header>
      {children}
    </div>
  )
}
