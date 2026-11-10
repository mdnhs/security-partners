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
        "text-xs font-black tracking-[0.125em] text-brand-green uppercase md:text-sm md:tracking-[0.14em]",
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
        "flex flex-col gap-2.5 md:gap-3.5",
        align === "center"
          ? "items-start text-left md:items-center md:text-center"
          : "items-start",
        className
      )}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-[30px] leading-9 font-black tracking-[-0.01em] text-brand-navy sm:text-4xl sm:leading-[1.15] md:text-[44px]">
        {title}
      </h2>
      {description && (
        <p className="max-w-[680px] text-base leading-6 text-brand-ink md:text-lg md:leading-[1.6]">
          {description}
        </p>
      )}
    </div>
  )
}
