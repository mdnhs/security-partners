import { cn } from "@/lib/utils"

/** A numbered form section (Figma 550:501): green number, title, subtitle. */
export function FormSection({
  number,
  title,
  subtitle,
  className,
  children,
}: {
  number: number
  title: string
  subtitle: string
  /** Phones show one section at a time; the form hides the others here. */
  className?: string
  children: React.ReactNode
}) {
  const id = `section-${number}`
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "flex flex-col gap-5 border-t border-brand-line pt-9 first:border-t-0 first:pt-0 max-md:border-0 max-md:pt-0",
        className
      )}
    >
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="mt-[5px] flex size-[38px] shrink-0 items-center justify-center rounded-full bg-brand-green text-[15px] font-black text-white max-md:hidden"
        >
          {String(number).padStart(2, "0")}
        </span>
        <div className="flex flex-col gap-0.5">
          <h2
            id={id}
            className="text-[26px] leading-8 font-black text-brand-navy md:text-[22px] md:leading-[1.2]"
          >
            {title}
          </h2>
          {subtitle && (
            <p className="text-base leading-6 text-brand-ink md:text-sm md:leading-normal md:text-brand-muted">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}
