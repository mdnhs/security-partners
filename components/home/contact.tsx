import Image from "next/image"

import { ContactForm } from "@/components/home/contact-form"
import { Container, SectionHeading } from "@/components/home/section"
import { contact } from "@/components/home/data"

const infoItems = [
  {
    title: "Office Hours",
    icon: "/images/clock.svg",
    lines: [{ text: "Monday–Friday: 9am to 6pm" }],
  },
  {
    title: "24 Hour Number",
    icon: "/images/phone.svg",
    lines: [{ text: contact.phone24h, href: contact.phone24hHref }],
  },
  {
    title: "Address",
    icon: "/images/pin.svg",
    lines: [{ text: contact.addressLine1 }, { text: contact.addressLine2 }],
  },
  {
    title: "Operations",
    icon: "/images/mail.svg",
    lines: [
      { text: `Tel: ${contact.office} Ext 2`, href: contact.officeHref },
      { text: `or ${contact.operationsMobile}`, href: "tel:+353858591299" },
      {
        text: contact.operationsEmail,
        href: `mailto:${contact.operationsEmail}`,
      },
    ],
  },
]

export function Contact() {
  return (
    <section
      id="contact"
      className="scroll-mt-28 bg-white px-6 py-20 md:px-10 lg:py-28"
    >
      <Container className="flex flex-col gap-8 lg:flex-row lg:items-stretch">
        <div
          data-reveal
          className="flex flex-1 flex-col gap-5 rounded-[28px] border border-brand-line bg-white p-6 shadow-[0px_16px_40px_0px_rgba(13,26,51,0.08)] md:p-12"
        >
          <SectionHeading
            align="start"
            eyebrow="Contact"
            title="Get In Touch"
            className="[&_h2]:text-[36px] [&_p:last-child]:text-base"
            description="Send us a message and we'll get back to you within one working day."
          />
          <ContactForm />
        </div>

        <ul
          data-reveal
          className="flex shrink-0 flex-col gap-7 rounded-[28px] bg-brand-blue px-10 py-12 lg:w-[440px]"
        >
          {infoItems.map((item) => (
            <li key={item.title} className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-brand-green">
                <Image src={item.icon} alt="" width={22} height={22} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-[17px] font-black text-white">
                  {item.title}
                </p>
                {item.lines.map((line) =>
                  "href" in line && line.href ? (
                    <a
                      key={line.text}
                      href={line.href}
                      className="text-[15px] leading-normal break-words text-white/85 hover:text-white hover:underline"
                    >
                      {line.text}
                    </a>
                  ) : (
                    <p
                      key={line.text}
                      className="text-[15px] leading-normal text-white/85"
                    >
                      {line.text}
                    </p>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

// Static map tiles from the design, laid out on a 9×2 grid of 256px tiles.
const mapTiles = Array.from({ length: 9 }, (_, col) =>
  [0, 1].map((row) => ({ col, row }))
).flat()

export function LocationMap() {
  return (
    <a
      href={contact.mapsHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open Security Partners Ltd. location in Google Maps"
      data-map
      className="relative block h-[480px] overflow-hidden bg-brand-map"
    >
      <div className="absolute top-[calc(50%+5px)] left-[calc(50%+8.5px)] h-[512px] w-[2304px] -translate-x-1/2 -translate-y-1/2">
        <div
          data-map-tiles
          className="relative size-full will-change-transform"
        >
          {mapTiles.map(({ col, row }) => (
            <Image
              key={`${col}-${row}`}
              src={`/images/map/tile-${col}-${row}.png`}
              alt=""
              width={256}
              height={256}
              className="absolute size-64 max-w-none"
              style={{ left: col * 256, top: row * 256 }}
            />
          ))}
        </div>
      </div>
      <div className="absolute inset-0 bg-brand-blue/6" />
      <div className="absolute top-[calc(50%-17px)] left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5">
        <div
          data-map-label
          className="flex items-center gap-2.5 rounded-full bg-white py-2 pr-4 pl-2 shadow-[0px_6px_18px_0px_rgba(0,0,0,0.18)]"
        >
          <div className="relative size-9 overflow-hidden rounded-full border border-brand-green/25 bg-white">
            <div className="absolute top-px left-px size-8">
              <Image
                src="/images/logo.png"
                alt=""
                fill
                sizes="32px"
                className="object-contain"
              />
            </div>
          </div>
          <p className="text-base font-black whitespace-nowrap text-brand-navy">
            Security Partners Ltd.
          </p>
        </div>
        <Image
          data-map-pin
          src="/images/map-pin.svg"
          alt=""
          width={120}
          height={96}
        />
      </div>
    </a>
  )
}
