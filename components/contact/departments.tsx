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
    <section className="bg-brand-surface px-6 py-20 md:px-10 lg:py-28">
      <Container className="flex flex-col gap-14">
        <SectionHeading eyebrow={eyebrow} title={heading} description={intro} />
        <ul data-stagger className="grid gap-6 lg:grid-cols-3">
          {items.map((department) => (
            <li
              key={department.title}
              className="flex flex-col items-start gap-4 rounded-3xl border border-brand-line bg-white px-8 py-9 shadow-[0px_12px_20px_0px_rgba(13,26,51,0.06)]"
            >
              <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-green">
                <Image src={department.icon} alt="" width={24} height={24} />
              </div>
              <h3 className="text-[22px] leading-[normal] font-black text-brand-navy">
                {department.title}
              </h3>
              <div className="flex flex-col gap-0.5 leading-[normal] font-bold">
                <p className="text-base leading-[normal] text-brand-navy">
                  {department.name}
                </p>
                <p className="text-sm leading-[normal] text-brand-green-dark">
                  {department.role}
                </p>
              </div>
              <div className="h-px w-full bg-brand-line" />
              {department.lines.map((line) => (
                <a
                  key={line.text}
                  href={line.href}
                  className="text-[15px] leading-[normal] break-all text-brand-ink hover:text-brand-blue"
                >
                  {line.text}
                </a>
              ))}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
