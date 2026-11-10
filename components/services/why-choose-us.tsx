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
    <section
      data-story-track
      className="bg-brand-blue px-5 py-14 md:px-10 md:py-20 lg:py-28"
    >
      <div data-story-stage className="w-full">
        <Container className="flex flex-col gap-6 md:gap-14">
          <div
            data-stagger
            className="flex flex-col items-start gap-2.5 text-left md:items-center md:gap-3.5 md:text-center"
          >
            <Eyebrow>{eyebrow}</Eyebrow>
            <h2 className="text-[30px] leading-9 font-black tracking-[-0.01em] text-white sm:text-4xl sm:leading-[1.15] md:text-[44px]">
              {heading}
            </h2>
            <p className="max-w-[680px] text-base leading-6 text-white/85 md:text-lg md:leading-[1.6]">
              {copy}
            </p>
          </div>

          <div
            aria-hidden
            className="h-0.5 w-full overflow-hidden rounded-full bg-white/15 max-md:hidden"
          >
            <div
              data-story-bar
              className="h-full origin-left rounded-full bg-brand-green"
            />
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
            {features.map((feature) => (
              <li
                key={feature.title}
                data-story-card
                data-card="dark"
                className="flex items-start gap-4 rounded-[20px] border border-brand-line bg-white p-5 transition-[box-shadow,border-color,background-color] duration-300 ease-out hover:border-white/45 hover:bg-white/12 hover:shadow-[0px_18px_40px_0px_rgba(0,0,0,0.25)] max-md:hover:bg-white md:flex-col md:gap-3.5 md:rounded-3xl md:border-white/18 md:bg-white/8 md:px-7 md:py-8"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-brand-green md:size-14 md:rounded-2xl">
                  <Image
                    src={feature.icon}
                    alt=""
                    width={24}
                    height={24}
                    className="size-[22px] md:size-6"
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 md:gap-3.5">
                  <h3 className="text-lg leading-[23px] font-black text-brand-navy md:text-xl md:leading-[normal] md:text-white">
                    {feature.title}
                  </h3>
                  <p className="text-[15px] leading-[22px] text-brand-ink md:leading-[1.6] md:text-white/80">
                    {feature.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </div>
    </section>
  )
}
