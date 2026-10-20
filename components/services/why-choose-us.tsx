import Image from "next/image"

import { Container, Eyebrow } from "@/components/home/section"

export type WhyChooseUsProps = {
  eyebrow: string
  heading: string
  copy: string
  features: { title: string; description: string; icon: string }[]
}

export function WhyChooseUs({
  eyebrow,
  heading,
  copy,
  features,
}: WhyChooseUsProps) {
  return (
    <section className="bg-brand-blue px-6 py-20 md:px-10 lg:py-28">
      <Container className="flex flex-col gap-14">
        <div
          data-stagger
          className="flex flex-col items-center gap-3.5 text-center"
        >
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="text-4xl leading-[1.15] font-black tracking-[-0.01em] text-white md:text-[44px]">
            {heading}
          </h2>
          <p className="max-w-[680px] text-lg leading-[1.6] text-white/85">
            {copy}
          </p>
        </div>

        <ul data-stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <li
              key={feature.title}
              className="flex flex-col items-start gap-3.5 rounded-3xl border border-white/18 bg-white/8 px-7 py-8"
            >
              <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-green">
                <Image src={feature.icon} alt="" width={24} height={24} />
              </div>
              <h3 className="text-xl leading-[normal] font-black text-white">
                {feature.title}
              </h3>
              <p className="text-[15px] leading-[1.6] text-white/80">
                {feature.description}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
