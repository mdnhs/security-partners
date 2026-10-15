import Image from "next/image"

import { Container, SectionHeading } from "@/components/home/section"
import { cn } from "@/lib/utils"

type IconCard = { title: string; description: string; icon: string }

export function IconCards({
  eyebrow,
  title,
  description,
  items,
  className,
}: {
  eyebrow: string
  title: string
  description: string
  items: IconCard[]
  className?: string
}) {
  return (
    <section className={cn("bg-white px-6 py-20 md:px-10 lg:py-28", className)}>
      <Container className="flex flex-col gap-14">
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
          description={description}
        />

        <ul data-stagger className="grid gap-6 lg:grid-cols-3">
          {items.map((value) => (
            <li
              key={value.title}
              className="flex flex-col items-start gap-4 rounded-3xl border border-brand-line bg-white px-8 py-9 shadow-[0px_12px_20px_0px_rgba(13,26,51,0.06)]"
            >
              <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-green">
                <Image src={value.icon} alt="" width={24} height={24} />
              </div>
              <h3 className="text-[22px] leading-[normal] font-black text-brand-navy">
                {value.title}
              </h3>
              <p className="text-base leading-[1.6] text-brand-ink">
                {value.description}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
