import Image from "next/image"

import { Container, Eyebrow } from "@/components/home/section"
import { highlights } from "@/components/home/data"

export function About() {
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
            <Eyebrow>Who we are</Eyebrow>
            <h2 className="text-4xl leading-[1.15] font-black tracking-[-0.01em] text-white md:text-[44px]">
              A family-run security company you can trust
            </h2>
          </div>
          <p
            data-about-copy
            className="text-[17px] leading-[1.65] text-white/88"
          >
            Security Partners Ltd is a privately owned security company based in
            Mountmellick, Co. Laois. We are strategically based in the midlands,
            allowing us to provide services across Ireland.
          </p>
          <p
            data-about-copy
            className="text-[17px] leading-[1.65] text-white/88"
          >
            Since our foundation in 2008, our objective has been and still is to
            provide a first class service to all sectors of business. We are
            dedicated to safeguarding our clients&apos; business and investment,
            and giving them peace of mind.
          </p>
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
              src="/images/about.png"
              alt="Security Partners officer reviewing paperwork"
              fill
              sizes="(min-width: 1024px) 480px, 100vw"
              className="object-cover"
            />
          </div>
          <div
            data-about-badge
            className="relative flex w-fit items-center gap-3.5 rounded-[18px] bg-white px-5 py-4 shadow-[0px_8px_24px_0px_rgba(0,0,0,0.15)]"
          >
            <p className="text-[30px] font-black text-brand-blue">2008</p>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-bold text-brand-navy">Established</p>
              <p className="text-[13px] text-brand-ink">
                Mountmellick, Co. Laois
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
