import { Mail, Navigation, Phone } from "lucide-react"
import Image from "next/image"

import {
  ContactForm,
  type ContactFormProps,
} from "@/components/home/contact-form"
import { Container, SectionHeading } from "@/components/home/section"
import { interpolate } from "@/lib/interpolate"

export type ContactProps = {
  eyebrow: string
  heading: string
  intro: string
  infoItems: {
    title: string
    icon: string
    lines: { text: string; href?: string }[]
  }[]
  form: ContactFormProps
}

export function Contact({
  eyebrow,
  heading,
  intro,
  infoItems,
  form,
}: ContactProps) {
  return (
    <section
      id="contact"
      className="scroll-mt-28 bg-white px-5 py-14 md:px-10 md:py-20 lg:py-28"
    >
      <Container className="flex flex-col gap-5 md:gap-8 lg:flex-row lg:items-stretch">
        <div
          data-reveal
          className="flex flex-1 flex-col gap-5 md:rounded-[28px] md:border md:border-brand-line md:bg-white md:p-12 md:shadow-[0px_16px_40px_0px_rgba(13,26,51,0.08)]"
        >
          <SectionHeading
            align="start"
            eyebrow={eyebrow}
            title={heading}
            className="md:[&_h2]:text-[36px] [&_p:last-child]:text-base"
            description={intro}
          />
          <QuickActions infoItems={infoItems} />
          <div className="rounded-[20px] border border-brand-line p-5 md:rounded-none md:border-0 md:p-0">
            <ContactForm {...form} />
          </div>
        </div>

        <ul
          data-reveal
          data-contact-info
          className="flex shrink-0 flex-col gap-5 rounded-[20px] bg-brand-blue p-6 md:gap-7 md:rounded-[28px] md:px-10 md:py-12 lg:w-[440px]"
        >
          {infoItems.map((item) => (
            <li key={item.title} className="flex items-start gap-3.5 md:gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-green md:size-12 md:rounded-[14px]">
                <Image src={item.icon} alt="" width={22} height={22} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-[3px] md:gap-1">
                <p className="text-base leading-[21px] font-black text-white md:text-[17px] md:leading-[normal]">
                  {item.title}
                </p>
                {item.lines.map((line) =>
                  line.href ? (
                    <a
                      key={line.text}
                      href={line.href}
                      className="text-sm leading-[21px] break-words text-white/85 hover:text-white hover:underline md:text-[15px] md:leading-normal"
                    >
                      {line.text}
                    </a>
                  ) : (
                    <p
                      key={line.text}
                      className="text-sm leading-[21px] text-white/85 md:text-[15px] md:leading-normal"
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

/** Phone-only shortcuts above the form: call, email, directions. */
function QuickActions({ infoItems }: { infoItems: ContactProps["infoItems"] }) {
  const hrefs = infoItems.flatMap((item) => item.lines.map((l) => l.href ?? ""))
  const tel = hrefs.find((h) => h.startsWith("tel:"))
  const mail = hrefs.find((h) => h.startsWith("mailto:"))
  const actions = [
    { Icon: Phone, label: "Call 24/7", sub: "Any time", href: tel },
    { Icon: Mail, label: "Email Us", sub: "Reply in 1 day", href: mail },
    {
      Icon: Navigation,
      label: "Directions",
      sub: "Mountmellick",
      href: "https://www.google.com/maps/search/?api=1&query=Security+Partners+Ltd+Mountmellick",
    },
  ].filter((a) => a.href)
  return (
    <div className="flex gap-2.5 md:hidden">
      {actions.map(({ Icon, label, sub, href }) => (
        <a
          key={label}
          href={href}
          className="flex min-w-0 flex-1 flex-col items-center gap-2 rounded-2xl border border-brand-line bg-brand-surface px-1.5 py-3.5 text-center"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-brand-green text-white">
            <Icon aria-hidden className="size-[18px]" />
          </span>
          <span className="text-[13px] font-bold text-brand-navy">{label}</span>
          <span className="text-xs text-brand-muted">{sub}</span>
        </a>
      ))}
    </div>
  )
}

export type LocationMapProps = {
  href: string
  ariaLabel: string
  label: string
  logo: string
  /** Tile URL template with {col} (0–8) and {row} (0–1). */
  tiles: string
}

// Static map tiles from the design, laid out on a 9×2 grid of 256px tiles.
const mapTiles = Array.from({ length: 9 }, (_, col) =>
  [0, 1].map((row) => ({ col, row }))
).flat()

export function LocationMap({
  href,
  ariaLabel,
  label,
  logo,
  tiles,
}: LocationMapProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      data-map
      className="relative block h-[300px] overflow-hidden bg-brand-map md:h-[480px]"
    >
      <div className="absolute top-[calc(50%+5px)] left-[calc(50%+8.5px)] h-[512px] w-[2304px] -translate-x-1/2 -translate-y-1/2">
        <div
          data-map-tiles
          className="relative size-full will-change-transform"
        >
          {mapTiles.map(({ col, row }) => (
            <Image
              key={`${col}-${row}`}
              src={interpolate(tiles, { col, row })}
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
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[linear-gradient(to_bottom,rgba(255,255,255,1)_0%,rgba(255,255,255,0.97)_10%,rgba(255,255,255,0.88)_22%,rgba(255,255,255,0.72)_36%,rgba(255,255,255,0.5)_52%,rgba(255,255,255,0.28)_68%,rgba(255,255,255,0.12)_83%,rgba(255,255,255,0.03)_93%,rgba(255,255,255,0)_100%)]" />
      <div className="absolute top-[calc(50%-17px)] left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5">
        <div
          data-map-label
          className="flex items-center gap-2.5 rounded-full bg-white py-2 pr-4 pl-2 shadow-[0px_6px_18px_0px_rgba(0,0,0,0.18)]"
        >
          <div className="relative size-9 overflow-hidden rounded-full border border-brand-green/25 bg-white">
            <div className="absolute top-px left-px size-8">
              <Image
                src={logo}
                alt=""
                fill
                sizes="32px"
                className="object-contain"
              />
            </div>
          </div>
          <p className="text-base font-black whitespace-nowrap text-brand-navy">
            {label}
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
