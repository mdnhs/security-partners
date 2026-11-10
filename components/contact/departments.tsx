import { ChevronRight, Mail, Phone } from "lucide-react"
import Image from "next/image"

import { Container, SectionHeading } from "@/components/home/section"

export type DepartmentsProps = {
  eyebrow: string
  heading: string
  intro: string
  items: {
    title: string
    icon: string
    name: string
    role: string
    lines: { text: string; href: string }[]
  }[]
}

export function Departments({
  eyebrow,
  heading,
  intro,
  items,
}: DepartmentsProps) {
  return (
    <section className="bg-brand-surface px-5 py-14 md:px-10 md:py-20 lg:py-28">
      <Container className="flex flex-col gap-6 md:gap-14">
        <SectionHeading eyebrow={eyebrow} title={heading} description={intro} />
        <ul data-stagger className="grid gap-3 md:gap-6 lg:grid-cols-3">
          {items.map((department) => (
            <li
              key={department.title}
              data-card="light"
              className="group flex flex-col items-stretch gap-3.5 rounded-[20px] border border-brand-line bg-white p-5 shadow-[0px_12px_20px_0px_rgba(13,26,51,0.06)] transition-[translate,box-shadow,border-color] duration-300 ease-out hover:border-brand-blue/40 hover:shadow-[0px_18px_40px_0px_rgba(13,26,51,0.12)] motion-safe:hover:-translate-y-1 md:items-start md:gap-4 md:rounded-3xl md:px-8 md:py-9"
            >
              <div className="flex items-center gap-3.5 md:flex-col md:items-start md:gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-brand-green md:size-14 md:rounded-2xl">
                  <Image
                    src={department.icon}
                    alt=""
                    width={24}
                    height={24}
                    className="size-[22px] md:size-6"
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 md:gap-4">
                  <h3 className="text-xl leading-[normal] font-black text-brand-navy group-hover:bg-linear-to-r group-hover:from-brand-green group-hover:to-brand-blue group-hover:bg-clip-text group-hover:text-transparent md:text-[22px]">
                    {department.title}
                  </h3>
                  <div className="flex flex-wrap gap-x-1 leading-[normal] font-bold md:flex-col md:gap-x-0 md:gap-y-0.5">
                    <p className="text-[13px] leading-[18px] text-brand-green-dark md:text-base md:leading-[normal] md:text-brand-navy">
                      {department.name}
                      <span className="md:hidden">
                        {" · "}
                        {department.role}
                      </span>
                    </p>
                    <p className="text-sm leading-[normal] text-brand-green-dark max-md:hidden">
                      {department.role}
                    </p>
                  </div>
                </div>
              </div>
              <div className="h-px w-full bg-brand-line max-md:hidden" />
              <div className="flex flex-col gap-2 md:gap-4">
                {department.lines.map((line) => {
                  const Icon = line.href.startsWith("mailto:") ? Mail : Phone
                  return (
                    <a
                      key={line.text}
                      href={line.href}
                      className="flex items-center gap-2.5 rounded-xl bg-brand-surface px-3.5 py-3 text-sm leading-5 font-bold break-all text-brand-blue md:gap-0 md:rounded-none md:bg-transparent md:p-0 md:text-[15px] md:leading-[normal] md:font-normal md:text-brand-ink md:hover:text-brand-blue"
                    >
                      <Icon
                        aria-hidden
                        className="size-[18px] shrink-0 md:hidden"
                      />
                      <span className="min-w-0 flex-1">{line.text}</span>
                      <ChevronRight
                        aria-hidden
                        className="size-4 shrink-0 md:hidden"
                      />
                    </a>
                  )
                })}
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
