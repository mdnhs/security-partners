import Image from "next/image"

import { buttonClassName } from "@/components/ui/button"
import { Container, Eyebrow, SectionHeading } from "@/components/home/section"
import { contact, services } from "@/components/home/data"

export function Services() {
  return (
    <section
      id="services"
      className="scroll-mt-28 bg-white px-6 py-20 md:px-10 lg:py-28"
    >
      <Container className="flex flex-col items-center gap-14">
        <SectionHeading
          eyebrow="What we do"
          title="Our Services"
          description="Professional security solutions for every sector, from a single alarm response to full-time static guarding."
        />

        <ul
          data-stagger
          className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {services.map((service) => (
            <li
              key={service.title}
              className="flex flex-col items-start gap-4 rounded-3xl border border-brand-line bg-white px-8 py-9 shadow-[0px_10px_30px_0px_rgba(13,26,51,0.06)]"
            >
              <div
                data-service-icon
                className="flex size-[88px] items-center justify-center overflow-hidden rounded-[20px] bg-brand-mint"
              >
                <div className="relative size-[120px] shrink-0">
                  <Image
                    src={service.icon}
                    alt=""
                    fill
                    sizes="120px"
                    className="object-contain"
                  />
                </div>
              </div>
              <h3 className="text-[22px] font-black text-brand-navy">
                {service.title}
              </h3>
              <p className="text-base leading-[1.6] text-brand-ink">
                {service.description}
              </p>
              <a
                href="#contact"
                className="flex items-center gap-2 text-[15px] font-bold text-brand-blue hover:underline"
                aria-label={`Read more about ${service.title}`}
              >
                Read More <span aria-hidden>→</span>
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

export function EnquireBanner() {
  return (
    <section className="bg-white px-6 pb-20 md:px-10 lg:pb-28">
      <Container>
        <div
          data-banner
          className="relative flex flex-col items-center gap-6 overflow-hidden rounded-[32px] px-6 py-16 text-center md:p-20"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div
              data-parallax
              className="absolute inset-x-0 -top-[15%] h-[130%] will-change-transform"
            >
              <Image
                src="/images/banner.png"
                alt=""
                fill
                sizes="(min-width: 1280px) 1200px, 100vw"
                className="object-cover"
              />
            </div>
            <div className="absolute inset-0 bg-linear-to-r from-brand-blue/95 to-brand-blue-deep/85" />
          </div>
          <Eyebrow data-banner-item className="relative">
            Get in touch
          </Eyebrow>
          <h2
            data-banner-item
            className="relative text-4xl font-black tracking-[-0.01em] text-white md:text-5xl"
          >
            Enquire About Our Services
          </h2>
          <p
            data-banner-item
            className="relative max-w-[620px] text-lg leading-[1.6] text-white/85"
          >
            Tell us what you need protecting and our team will come back to you
            with a tailored, no-obligation quote.
          </p>
          <div
            data-banner-item
            className="relative flex flex-wrap justify-center gap-4 pt-2"
          >
            <a
              href="#contact"
              className={buttonClassName({ variant: "brand", size: "pill" })}
            >
              Get a Quote
            </a>
            <a
              href={contact.officeHref}
              className={buttonClassName({
                variant: "brand-outline",
                size: "pill",
              })}
            >
              Call {contact.office}
            </a>
          </div>
        </div>
      </Container>
    </section>
  )
}
