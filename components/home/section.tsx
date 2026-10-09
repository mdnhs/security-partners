import { cn } from "@/lib/utils"

export function Container({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1200px]", className)}
      {...props}
    />
  )
}

export function Eyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-sm font-black tracking-[0.14em] text-brand-green uppercase",
        className
      )}
      {...props}
    />
  )
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: {
  eyebrow: string
  title: string
  description?: string
  align?: "center" | "start"
  className?: string
}) {
  return (
    <div
      data-stagger
      className={cn(
        "flex flex-col gap-3.5",
        align === "center" ? "items-center text-center" : "items-start",
        className
      )}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-4xl leading-[1.15] font-black tracking-[-0.01em] text-brand-navy md:text-[44px]">
        {title}
      </h2>
      {description && (
        <p className="max-w-[680px] text-lg leading-[1.6] text-brand-ink">
          {description}
        </p>
      )}
    </div>
  )
}
