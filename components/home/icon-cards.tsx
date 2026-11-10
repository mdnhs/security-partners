import Image from "next/image"

import { Container, SectionHeading } from "@/components/home/section"
import { cn } from "@/lib/utils"

type IconCard = { title: string; description: string; icon: string }

export type IconCardsProps = {
  eyebrow: string
  title: string
  description: string
  items: IconCard[]
  className?: string
}

export function IconCards({
  eyebrow,
  title,
  description,
  items,
  className,
}: IconCardsProps) {
  return (
    <section
      className={cn(
        "bg-white px-5 py-14 md:px-10 md:py-20 lg:py-28",
        className
      )}
    >
      <Container className="flex flex-col gap-6 md:gap-14">
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
          description={description}
        />

        <ul data-stagger className="grid gap-3 md:gap-6 lg:grid-cols-3">
          {items.map((value) => (
            <li
              key={value.title}
              data-card="light"
              className="group flex items-start gap-4 rounded-[20px] border border-brand-line bg-white p-5 shadow-[0px_12px_20px_0px_rgba(13,26,51,0.06)] transition-[translate,box-shadow,border-color] duration-300 ease-out hover:border-brand-blue/40 hover:shadow-[0px_18px_40px_0px_rgba(13,26,51,0.12)] motion-safe:hover:-translate-y-1 max-md:flex-row md:flex-col md:rounded-3xl md:px-8 md:py-9"
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-brand-green md:size-14 md:rounded-2xl">
                <Image
                  src={value.icon}
                  alt=""
                  width={24}
                  height={24}
                  className="size-[22px] md:size-6"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 md:gap-4">
                <h3 className="text-lg leading-[23px] font-black text-brand-navy group-hover:bg-linear-to-r group-hover:from-brand-green group-hover:to-brand-blue group-hover:bg-clip-text group-hover:text-transparent md:text-[22px] md:leading-[normal]">
                  {value.title}
                </h3>
                <p className="text-[15px] leading-[22px] text-brand-ink md:text-base md:leading-[1.6]">
                  {value.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
