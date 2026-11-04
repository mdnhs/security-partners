/** A numbered form section (Figma 550:501): green number, title, subtitle. */
export function FormSection({
  number,
  title,
  subtitle,
  children,
}: {
  number: number
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  const id = `section-${number}`
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-5 border-t border-brand-line pt-9 first:border-t-0 first:pt-0"
    >
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="mt-[5px] flex size-[38px] shrink-0 items-center justify-center rounded-full bg-brand-green text-[15px] font-black text-white"
        >
          {String(number).padStart(2, "0")}
        </span>
        <div className="flex flex-col gap-0.5">
          <h2
            id={id}
            className="text-[22px] leading-[1.2] font-black text-brand-navy"
          >
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm leading-normal text-brand-muted">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}
