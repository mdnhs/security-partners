import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * The admin's form control look (JW schema forms): 40 px, rounded, on the
 * page background, brand focus ring. Added to the shared shadcn controls
 * (the public site keeps their defaults).
 */
export const ADMIN_CONTROL =
  "h-10 rounded-lg bg-background px-3 text-sm shadow-xs md:text-sm"
export const ADMIN_TEXTAREA =
  "min-h-24 rounded-lg bg-background px-3 py-2.5 text-sm leading-relaxed shadow-xs md:text-sm"

/** Grid for fields: two columns once the card is 36rem wide. */
export const FIELD_GRID = "grid gap-x-5 gap-y-6 @xl/card:grid-cols-2"
/** A grid cell spanning both columns. */
export const FULL_SPAN = "@xl/card:col-span-2"

/**
 * A titled card of fields (JW TitledSection look): heading, optional
 * description, then the content. Labelled by its heading.
 */
export function FormCard({
  id,
  title,
  description,
  headingLevel = 2,
  className,
  children,
  ...rest
}: {
  /** Base for the heading / description ids. */
  id: string
  /** No title: an untitled card (named by its fields). */
  title?: ReactNode
  description?: ReactNode
  headingLevel?: 2 | 3
  className?: string
  children: ReactNode
} & Omit<React.ComponentProps<"section">, "id" | "title">) {
  const Heading = headingLevel === 2 ? "h2" : "h3"
  return (
    <section
      data-slot="form-card"
      aria-labelledby={title ? `${id}-title` : undefined}
      className={cn(
        "@container/card flex min-w-0 flex-col gap-5 rounded-2xl border bg-card p-4 shadow-xs sm:p-6",
        className
      )}
      {...rest}
    >
      {title ? (
        <header className="flex flex-col gap-1">
          <Heading id={`${id}-title`} className="text-card-title">
            {title}
          </Heading>
          {description ? (
            <p
              id={`${id}-description`}
              className="text-sm text-muted-foreground"
            >
              {description}
            </p>
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  )
}

/** A titled part of a card (a rule above it, except the first). */
export function FormSubsection({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: ReactNode
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      data-slot="form-subsection"
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-4 border-t pt-5 first-of-type:border-t-0 first-of-type:pt-0"
    >
      <header className="flex flex-col gap-0.5">
        <h3 id={`${id}-title`} className="text-[15px] font-semibold">
          {title}
        </h3>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  )
}
