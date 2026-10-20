import Image from "next/image"

import { Container, Eyebrow } from "@/components/home/section"
import { renderInline } from "@/lib/rich-text/render"
import type { ParagraphsDoc } from "@/lib/schemas/common"

export type AboutProps = {
  eyebrow: string
  heading: string
  body: ParagraphsDoc
  image: { src: string; alt: string }
  badge: { value: string; label: string; caption: string }
  highlights: string[]
}

export function About({
  eyebrow,
  heading,
  body,
  image,
  badge,
  highlights,
}: AboutProps) {
  return (
    <section
      id="about"
      data-about
      className="scroll-mt-28 bg-brand-surface px-6 py-20 md:px-10 lg:py-28"
    >
      <Container className="flex flex-col gap-12 lg:flex-row lg:items-stretch">
        <div
          data-about-card
          className="flex flex-1 flex-col gap-[22px] rounded-[28px] bg-brand-blue p-8 md:p-14"
        >
          <div data-about-copy className="flex flex-col gap-3.5">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h2 className="text-4xl leading-[1.15] font-black tracking-[-0.01em] text-white md:text-[44px]">
              {heading}
            </h2>
          </div>
          {body.content.map((paragraph, i) => (
            <p
              key={i}
              data-about-copy
              className="text-[17px] leading-[1.65] text-white/88"
            >
              {renderInline(paragraph.content)}
            </p>
          ))}
          <ul className="flex flex-col gap-3.5 pt-2.5">
            {highlights.map((item) => (
              <li
                key={item}
                data-highlight
                className="flex items-center gap-3.5"
              >
                <Image
                  src="/images/check.svg"
                  alt=""
                  width={24}
                  height={24}
                  className="shrink-0"
                />
                <span className="text-base leading-normal font-medium text-white">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div
          data-about-media
          className="relative flex min-h-[420px] shrink-0 flex-col justify-end overflow-hidden rounded-[28px] pb-6 pl-6 lg:w-[480px]"
        >
          <div
            data-parallax
            className="absolute inset-x-0 -top-[8%] h-[116%] will-change-transform"
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes="(min-width: 1024px) 480px, 100vw"
              className="object-cover"
            />
          </div>
          <div
            data-about-badge
            className="relative flex w-fit items-center gap-3.5 rounded-[18px] bg-white px-5 py-4 shadow-[0px_8px_24px_0px_rgba(0,0,0,0.15)]"
          >
            <p className="text-[30px] font-black text-brand-blue">
              {badge.value}
            </p>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-bold text-brand-navy">{badge.label}</p>
              <p className="text-[13px] text-brand-ink">{badge.caption}</p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
