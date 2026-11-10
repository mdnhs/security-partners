import { ArrowRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

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
      className="scroll-mt-28 bg-brand-surface px-5 py-14 md:px-10 md:py-20 lg:py-28"
    >
      <Container className="flex flex-col-reverse gap-4 md:gap-12 lg:flex-row lg:items-stretch">
        <div
          data-about-card
          className="flex flex-1 flex-col gap-[18px] rounded-3xl bg-brand-blue px-6 py-7 md:gap-[22px] md:rounded-[28px] md:p-14"
        >
          <div data-about-copy className="flex flex-col gap-2.5 md:gap-3.5">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h2 className="text-[28px] leading-[34px] font-black tracking-[-0.01em] text-white sm:text-4xl sm:leading-[1.15] md:text-[44px]">
              {heading}
            </h2>
          </div>
          {body.content.map((paragraph, i) => (
            <p
              key={i}
              data-about-copy
              className="text-[15px] leading-[23px] text-white/88 sm:text-[17px] sm:leading-[1.65]"
            >
              {renderInline(paragraph.content)}
            </p>
          ))}
          <Link
            href="/about"
            className="flex items-center gap-1.5 pb-1 text-[15px] font-bold text-white md:hidden"
          >
            Read our story
            <ArrowRight aria-hidden className="size-4 text-brand-green" />
          </Link>
          <ul className="flex flex-col gap-3 pt-2.5 md:gap-3.5">
            {highlights.map((item) => (
              <li
                key={item}
                data-highlight
                className="flex items-start gap-3 md:items-center md:gap-3.5"
              >
                <Image
                  src="/images/check.svg"
                  alt=""
                  width={24}
                  height={24}
                  className="size-[22px] shrink-0 md:size-6"
                />
                <span className="text-[15px] leading-[22px] font-medium text-white md:text-base md:leading-normal">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div
          data-about-media
          className="relative flex min-h-[340px] shrink-0 flex-col justify-end overflow-hidden rounded-3xl pb-4 pl-4 md:min-h-[420px] md:rounded-[28px] md:pb-6 md:pl-6 lg:w-[480px]"
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
            className="relative flex w-fit items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0px_8px_24px_0px_rgba(0,0,0,0.15)] md:gap-3.5 md:rounded-[18px] md:px-5 md:py-4"
          >
            <p className="text-[26px] font-black text-brand-blue md:text-[30px]">
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
